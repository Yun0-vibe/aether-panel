import crypto from "node:crypto";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyRequest } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { setWsServer } from "./console.js";
import {
  COOKIE,
  createSession,
  destroySession,
  hashPassword,
  lookupUser,
  publicUser,
  requireAdmin,
  requireAuth,
  verifyPassword,
} from "./auth.js";
import { daemonFetch, specFromServer, statuses } from "./daemon.js";
import { db, getBranding, setBranding, type Egg, type Nest, type Node, type Server, type User, CUSTOM_EGG_ID } from "./db.js";
import { registerFilesBackups } from "./files-backups.js";
import { startScheduler } from "./scheduler.js";
import { newTotpSecret, otpauthUri, verifyTotp } from "./totp.js";
import QRCode from "qrcode";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

const app = Fastify({ logger: false, trustProxy: true });
app.register(cookie);
registerFilesBackups(app);
startScheduler();

const id = () => crypto.randomUUID();
const now = () => Date.now();

type Authed = FastifyRequest & { user: User };

// Short-lived MFA handoff (password ok, waiting for the TOTP code) and
// WebAuthn challenge storage. In-memory is fine: they live for minutes.
const mfaPending = new Map<string, { userId: string; exp: number }>();
const regChallenges = new Map<string, string>(); // userId -> challenge
const reauthTokens = new Map<string, { userId: string; exp: number }>();
type AuthChallenge = { kind: "login" } | { kind: "reauth"; userId: string };
const authChallenges = new Map<string, AuthChallenge>();
const oauthStates = new Map<string, { userId?: string; exp: number }>();

const REAUTH_TTL = 10 * 60_000;

function pruneMaps() {
  const t = Date.now();
  for (const [k, v] of mfaPending) if (v.exp < t) mfaPending.delete(k);
  for (const [k, v] of oauthStates) if (v.exp < t) oauthStates.delete(k);
  for (const [k, v] of reauthTokens) if (v.exp < t) reauthTokens.delete(k);
}

/** WebAuthn puts the challenge inside clientDataJSON (base64url), not as a
 *  flat field on the assertion — this is the correct way to recover it. */
function clientChallenge(resp: { response?: { clientDataJSON?: string } } | undefined): string {
  try {
    const cd = JSON.parse(Buffer.from(String(resp?.response?.clientDataJSON ?? ""), "base64url").toString("utf8")) as { challenge?: string };
    return String(cd.challenge ?? "");
  } catch {
    return "";
  }
}

/** Sensitive operations (password change, viewing/managing passkeys) demand a
 *  fresh step-up verification: passkey assertion or TOTP code (or password for
 *  accounts with neither). */
function reauthOk(req: FastifyRequest, user: User): boolean {
  const tok = (req.headers["x-ae-reauth"] as string) || "";
  const entry = reauthTokens.get(tok);
  return Boolean(entry && entry.userId === user.id && entry.exp > Date.now());
}

function originOf(req: FastifyRequest): string {
  const cfg = process.env.AETHER_PUBLIC_ORIGIN?.replace(/\/+$/, "");
  if (cfg) return cfg;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}

function rpIdOf(origin: string): string {
  try {
    return new URL(origin).hostname; // WebAuthn rpID is a bare hostname, no port
  } catch {
    return "localhost";
  }
}

// ---------------------------------------------------------------- auth

app.post("/api/auth/register", async (req, reply) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return reply.status(400).send({ error: "email and password are required" });
  }
  if (password.length < 8) {
    return reply.status(400).send({ error: "password must be at least 8 characters" });
  }
  const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as any).c as number;
  const openRegister = process.env.AETHER_OPEN_REGISTER === "true";
  if (userCount > 0 && !openRegister) {
    return reply
      .status(403)
      .send({ error: "registration is closed; ask an admin to create your account" });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return reply.status(409).send({ error: "email already registered" });
  }
  const user: User = {
    id: id(),
    email,
    password_hash: hashPassword(password),
    role: userCount === 0 ? "admin" : "user",
    created_at: now(),
  };
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(user.id, user.email, user.password_hash, user.role, user.created_at);
  createSession(reply, user.id);
  return { user: publicUser(user) };
});

app.post("/api/auth/login", async (req, reply) => {
  const body = (req.body ?? {}) as { email?: string; password?: string; totp?: string; mfaToken?: string };
  let row: User | undefined;

  // Two paths into this endpoint: full credentials, or a short-lived
  // mfaToken handed out when the password step already succeeded.
  if (body.mfaToken) {
    const pending = mfaPending.get(body.mfaToken);
    if (!pending || pending.exp < Date.now()) {
      return reply.status(401).send({ error: "mfa session expired — sign in again" });
    }
    mfaPending.delete(body.mfaToken);
    row = db.prepare("SELECT * FROM users WHERE id = ?").get(pending.userId) as User | undefined;
  } else {
    const email = (body.email ?? "").trim().toLowerCase();
    row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
    if (!row || !verifyPassword(body.password ?? "", row.password_hash)) {
      return reply.status(401).send({ error: "invalid credentials" });
    }
  }
  if (row?.totp_enabled) {
    const code = String(body.totp ?? "").trim();
    if (!code) {
      const token = crypto.randomBytes(16).toString("hex");
      mfaPending.set(token, { userId: row.id, exp: Date.now() + 5 * 60_000 });
      return reply.status(401).send({ error: "totp_required", mfaToken: token, totpRequired: true });
    }
    if (!verifyTotp(row.totp_secret ?? "", code)) {
      return reply.status(401).send({ error: "invalid authenticator code" });
    }
  }
  if (!row) return reply.status(401).send({ error: "invalid credentials" });
  createSession(reply, row.id);
  return { user: publicUser(row) };
});

app.post("/api/auth/logout", async (req, reply) => {
  destroySession(req, reply);
  return { ok: true };
});

app.get("/api/auth/me", async (req, reply) => {
  const user = lookupUser(req);
  if (!user) return reply.status(401).send({ error: "unauthorized" });
  return { user: publicUser(user) };
});

/* ------------------------------------------------------------ discord oauth */

function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

app.get("/api/auth/discord/status", async () => {
  return { enabled: discordConfigured() };
});

// Start the OAuth flow. If a session is present it links that account,
// otherwise it is a sign-in attempt resolved by discord_id.
app.get("/api/auth/discord", async (req, reply) => {
  if (!discordConfigured()) {
    return reply.status(501).send({ error: "Discord OAuth is not configured — set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env" });
  }
  pruneMaps();
  const me = lookupUser(req);
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, { userId: me?.id, exp: Date.now() + 10 * 60_000 });
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI || `${originOf(req)}/api/auth/discord/callback`,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });
  return reply.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
});

app.get("/api/auth/discord/callback", async (req, reply) => {
  const origin = originOf(req);
  if (!discordConfigured()) return reply.redirect(`${origin}/login?discord=unconfigured`, 302);
  const q = (req.query ?? {}) as { code?: string; state?: string; error?: string };
  const state = q.state ?? "";
  const entry = oauthStates.get(state);
  oauthStates.delete(state);
  if (q.error || !q.code || !entry || entry.exp < Date.now()) {
    return reply.redirect(`${origin}/login?discord=expired`, 302);
  }
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code: q.code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return reply.redirect(`${origin}/login?discord=token`, 302);
    const access = ((await tokenRes.json()) as { access_token?: string }).access_token ?? "";
    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!meRes.ok) return reply.redirect(`${origin}/login?discord=profile`, 302);
    const du = (await meRes.json()) as { id: string; username: string; discriminator?: string; avatar?: string | null };
    const avatar = du.avatar ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.png?size=64` : null;
    const handle = du.discriminator && du.discriminator !== "0" ? `${du.username}#${du.discriminator}` : du.username;

    if (entry.userId) {
      // LINK: attach discord identity to the signed-in user.
      const clash = db.prepare("SELECT id FROM users WHERE discord_id = ? AND id != ?").get(du.id, entry.userId);
      if (clash) return reply.redirect(`${origin}/profile?discord=taken`, 302);
      db.prepare("UPDATE users SET discord_id = ?, discord_username = ?, discord_avatar = ? WHERE id = ?").run(du.id, handle, avatar, entry.userId);
      return reply.redirect(`${origin}/profile?discord=linked`, 302);
    }

    // SIGN-IN: find the account this discord identity belongs to.
    const linked = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(du.id) as User | undefined;
    if (!linked) return reply.redirect(`${origin}/login?discord=notlinked`, 302);
    createSession(reply, linked.id);
    return reply.redirect(`${origin}/`, 302);
  } catch {
    return reply.redirect(`${origin}/login?discord=error`, 302);
  }
});

app.post("/api/account/discord/unlink", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  db.prepare("UPDATE users SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE id = ?").run(user.id);
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
  return { user: publicUser(fresh) };
});

/* ------------------------------------------------------------ totp 2fa */

app.post("/api/account/totp/setup", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  if (user.totp_enabled) return reply.status(400).send({ error: "2FA is already enabled" });
  const secret = newTotpSecret();
  db.prepare("UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?").run(secret, user.id);
  const branding = getBranding();
  const uri = otpauthUri({ label: user.email, secret, issuer: branding.panelName });
  return { secret, otpauth: uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#e8eefc", light: "#0d1424" } }) };
});

app.post("/api/account/totp/enable", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const body = (req.body ?? {}) as { code?: string };
  if (!user.totp_secret) return reply.status(400).send({ error: "run setup first" });
  if (user.totp_enabled) return reply.status(400).send({ error: "2FA is already enabled" });
  if (!verifyTotp(user.totp_secret, String(body.code ?? ""))) {
    return reply.status(401).send({ error: "invalid code — check your authenticator" });
  }
  db.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(user.id);
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
  const token = crypto.randomBytes(24).toString("hex");
  reauthTokens.set(token, { userId: user.id, exp: Date.now() + REAUTH_TTL });
  return { user: publicUser(fresh), reauthToken: token, expiresIn: REAUTH_TTL };
});

app.post("/api/account/totp/disable", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const body = (req.body ?? {}) as { password?: string };
  if (!verifyPassword(String(body.password ?? ""), user.password_hash)) {
    return reply.status(403).send({ error: "wrong password" });
  }
  db.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").run(user.id);
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
  return { user: publicUser(fresh) };
});

/* ------------------------------------------------------------ passkeys (webauthn) */

interface PasskeyRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string;
  backed_up: number;
  transports: string;
  created_at: number;
  last_used_at: number | null;
}

function passkeyView(p: PasskeyRow) {
  return {
    id: p.id,
    name: `Key · ${p.credential_id.slice(-10)}`,
    deviceType: p.device_type,
    backedUp: Boolean(p.backed_up),
    createdAt: p.created_at,
    lastUsedAt: p.last_used_at,
  };
}

app.get("/api/account/passkeys", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  if (!reauthOk(req, user)) return reply.status(403).send({ error: "Verify with your passkey or authenticator to view passkeys", reauthRequired: true });
  const rows = db.prepare("SELECT * FROM passkeys WHERE user_id = ? ORDER BY created_at DESC").all(user.id) as PasskeyRow[];
  return { passkeys: rows.map(passkeyView) };
});

// Enrollment is allowed without step-up for accounts with NO second factor yet
// (chicken-and-egg: you can't verify to add your first factor). Registering a
// passkey / confirming a TOTP code proves possession, so we treat it as a
// verified identity and issue a reauth token in the response.
async function enrollOk(req: FastifyRequest, user: User): Promise<boolean> {
  const pk = (db.prepare("SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?").get(user.id) as any).c as number;
  if (reauthOk(req, user)) return true;
  return pk === 0 && !user.totp_enabled;
}

app.post("/api/account/passkeys/options", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  if (!(await enrollOk(req, user))) return reply.status(403).send({ error: "Verify with your passkey or authenticator first", reauthRequired: true });
  const origin = originOf(req);
  const rpID = rpIdOf(origin);
  const existing = db.prepare("SELECT credential_id, transports FROM passkeys WHERE user_id = ?").all(user.id) as PasskeyRow[];
  const options = await generateRegistrationOptions({
    rpName: `${getBranding().panelName} passkey`,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credential_id,
      transports: p.transports ? (p.transports.split(",") as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[]) : undefined,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  regChallenges.set(user.id, options.challenge);
  return { options, origin, rpID };
});

app.post("/api/account/passkeys/register", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  if (!(await enrollOk(req, user))) return reply.status(403).send({ error: "Verify with your passkey or authenticator first", reauthRequired: true });
  const origin = originOf(req);
  const expectedChallenge = regChallenges.get(user.id);
  if (!expectedChallenge) return reply.status(400).send({ error: "no registration in progress" });
  try {
    const verification = await verifyRegistrationResponse({
      response: (req.body as any).response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpIdOf(origin),
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return reply.status(400).send({ error: "passkey registration failed" });
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const transports = (verification.registrationInfo as { credentialTransports?: string[] }).credentialTransports ?? [];
    db.prepare(
      `INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, device_type, backed_up, transports, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id(),
      user.id,
      credential.id,
      Buffer.from(credential.publicKey).toString("base64"),
      credential.counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      (transports as string[]).join(","),
      now(),
    );
    regChallenges.delete(user.id);
    const rows = db.prepare("SELECT * FROM passkeys WHERE user_id = ? ORDER BY created_at DESC").all(user.id) as PasskeyRow[];
    const token = crypto.randomBytes(24).toString("hex");
    reauthTokens.set(token, { userId: user.id, exp: Date.now() + REAUTH_TTL });
    return { verified: true, passkeys: rows.map(passkeyView), reauthToken: token, expiresIn: REAUTH_TTL };
  } catch (e) {
    return reply.status(400).send({ error: e instanceof Error ? e.message : "passkey registration failed" });
  }
});

app.delete("/api/account/passkeys/:pid", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  if (!reauthOk(req, user)) return reply.status(403).send({ error: "Verify with your passkey or authenticator first", reauthRequired: true });
  const row = db.prepare("SELECT * FROM passkeys WHERE id = ? AND user_id = ?").get((req.params as any).pid, user.id) as PasskeyRow | undefined;
  if (!row) return reply.status(404).send({ error: "passkey not found" });
  db.prepare("DELETE FROM passkeys WHERE id = ?").run(row.id);
  const rows = db.prepare("SELECT * FROM passkeys WHERE user_id = ? ORDER BY created_at DESC").all(user.id) as PasskeyRow[];
  return { passkeys: rows.map(passkeyView) };
});

// Passwordless sign-in challenge (discoverable credentials — no email needed).
app.post("/api/auth/passkey/options", async (req, reply) => {
  const origin = originOf(req);
  const options = await generateAuthenticationOptions({
    rpID: rpIdOf(origin),
    userVerification: "required",
  });
  authChallenges.set(options.challenge, { kind: "login" });
  setTimeout(() => authChallenges.delete(options.challenge), 5 * 60_000);
  return { options, origin, rpID: rpIdOf(origin) };
});

app.post("/api/auth/passkey/login", async (req, reply) => {
  const origin = originOf(req);
  const rpID = rpIdOf(origin);
  const body = (req.body ?? {}) as { response?: any };
  if (!body.response?.id) return reply.status(400).send({ error: "missing response" });
  const row = db.prepare("SELECT * FROM passkeys WHERE credential_id = ?").get(body.response.id) as PasskeyRow | undefined;
  if (!row) return reply.status(401).send({ error: "unknown passkey" });
  try {
    const challenge = clientChallenge(body.response);
    const entry = authChallenges.get(challenge);
    if (entry?.kind !== "login") return reply.status(401).send({ error: "expired sign-in attempt — try again" });
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: row.credential_id,
        publicKey: new Uint8Array(Buffer.from(row.public_key, "base64")),
        counter: row.counter,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) return reply.status(401).send({ error: "passkey verification failed" });
    authChallenges.delete(challenge);
    db.prepare("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?").run(verification.authenticationInfo.newCounter, now(), row.id);
    createSession(reply, row.user_id);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id) as User;
    return { user: publicUser(user) };
  } catch (e) {
    return reply.status(400).send({ error: e instanceof Error ? e.message : "passkey verification failed" });
  }
});

/* ------------------------------------------------------------ step-up re-auth */

// Which second factor this account can use for sensitive operations.
app.get("/api/account/reauth/methods", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const pk = (db.prepare("SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?").get(user.id) as any).c as number;
  return {
    passkey: pk > 0,
    totp: Boolean(user.totp_enabled),
    password: true,
  };
});

// For passkey step-up: an authentication challenge bound to this user's keys.
app.post("/api/account/reauth/begin", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const origin = originOf(req);
  const creds = db.prepare("SELECT credential_id FROM passkeys WHERE user_id = ?").all(user.id) as PasskeyRow[];
  const options = await generateAuthenticationOptions({
    rpID: rpIdOf(origin),
    userVerification: "required",
    allowCredentials: creds.map((p) => ({ id: p.credential_id })),
  });
  authChallenges.set(options.challenge, { kind: "reauth", userId: user.id });
  setTimeout(() => authChallenges.delete(options.challenge), 5 * 60_000);
  return { options, origin, rpID: rpIdOf(origin) };
});

// Verify step-up: passkey response, TOTP code, or password. Returns a
// short-lived reauth token the client sends back via the X-Ae-Reauth header.
app.post("/api/account/reauth/verify", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const body = (req.body ?? {}) as { response?: any; totp?: string; password?: string };
  let ok = false;
  try {
    if (body.response?.id) {
      const row = db.prepare("SELECT * FROM passkeys WHERE credential_id = ?").get(body.response.id) as PasskeyRow | undefined;
      if (row && row.user_id === user.id) {
        const challenge = clientChallenge(body.response);
        const expected = authChallenges.get(challenge);
        if (expected?.kind !== "reauth" || expected.userId !== user.id) {
          return reply.status(401).send({ error: "expired verification — try again" });
        }
        const verification = await verifyAuthenticationResponse({
          response: body.response,
          expectedChallenge: challenge,
          expectedOrigin: originOf(req),
          expectedRPID: rpIdOf(originOf(req)),
          credential: {
            id: row.credential_id,
            publicKey: new Uint8Array(Buffer.from(row.public_key, "base64")),
            counter: row.counter,
          },
          requireUserVerification: true,
        });
        ok = verification.verified;
        if (ok) {
          authChallenges.delete(challenge);
          db.prepare("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?").run(verification.authenticationInfo.newCounter, now(), row.id);
        }
      }
    } else if (body.totp) {
      ok = Boolean(user.totp_enabled) && verifyTotp(user.totp_secret ?? "", String(body.totp));
      if (!ok) return reply.status(403).send({ error: "invalid authenticator code" });
    } else if (body.password) {
      ok = verifyPassword(String(body.password), user.password_hash);
      if (!ok) return reply.status(403).send({ error: "incorrect password" });
    }
  } catch (e) {
    return reply.status(400).send({ error: e instanceof Error ? e.message : "verification failed" });
  }
  if (!ok) return reply.status(403).send({ error: "verification failed" });
  const token = crypto.randomBytes(24).toString("hex");
  reauthTokens.set(token, { userId: user.id, exp: Date.now() + REAUTH_TTL });
  return { reauthToken: token, expiresIn: REAUTH_TTL };
});

/* ------------------------------------------------------------ active sessions */

app.get("/api/account/sessions", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const currentToken = req.cookies[COOKIE];
  const rows = db
    .prepare("SELECT token, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY expires_at DESC")
    .all(user.id, Date.now()) as Array<{ token: string; expires_at: number }>;
  return {
    sessions: rows.map((s) => ({
      id: s.token.slice(0, 8),
      tail: s.token.slice(-6),
      expiresAt: s.expires_at,
      current: s.token === currentToken,
    })),
  };
});

app.delete("/api/account/sessions/:id", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const idPart = String((req.params as any).id);
  if (idPart.length !== 8) return reply.status(400).send({ error: "bad session id" });
  const rows = db.prepare("SELECT token FROM sessions WHERE user_id = ? AND expires_at > ?").all(user.id, Date.now()) as Array<{ token: string }>;
  const victim = rows.find((s) => s.token.startsWith(idPart));
  if (!victim) return reply.status(404).send({ error: "session not found" });
  db.prepare("DELETE FROM sessions WHERE token = ?").run(victim.token);
  return { ok: true };
});

app.post("/api/account/sessions/revoke-others", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const currentToken = req.cookies[COOKIE];
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(user.id, currentToken ?? "");
  return { ok: true };
});

// ---------------------------------------------------------------- account self-service

// Update the signed-in user's profile (display name, bio, discord link).
app.patch("/api/account", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const displayName = body.displayName === undefined ? user.display_name : String(body.displayName).slice(0, 48).trim();
  const bio = body.bio === undefined ? user.bio : String(body.bio).slice(0, 280).trim();
  if (displayName === "") return reply.status(400).send({ error: "Display name cannot be empty" });
  // Discord IDs must be a numeric snowflake (17-20 digits) or empty to unlink.
  const discordId =
    body.discordId === undefined ? (user.discord_id ?? "") : String(body.discordId).trim();
  if (discordId !== "" && !/^\d{17,20}$/.test(discordId)) {
    return reply.status(400).send({ error: "Discord ID must be a numeric snowflake (17-20 digits)" });
  }

  db.prepare("UPDATE users SET display_name = ?, bio = ?, discord_id = ? WHERE id = ?").run(
    displayName === "" ? null : displayName,
    bio === "" ? null : bio,
    discordId === "" ? null : discordId,
    user.id,
  );
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
  return { user: publicUser(fresh) };
});

// Change the signed-in user's password (requires the current password).
app.post("/api/account/password", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const next = String(body.newPassword ?? "");
  if (next.length < 6) return reply.status(400).send({ error: "New password must be at least 6 characters" });

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
  const hasPasskey = (db.prepare("SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?").get(user.id) as any).c > 0;
  const needsStepUp = hasPasskey || Boolean(row.totp_enabled);

  if (needsStepUp) {
    // Accounts with a second factor must verify fresh (passkey or TOTP) —
    // the current password alone is no longer enough to rotate it.
    if (!reauthOk(req, row)) {
      return reply.status(403).send({ error: "Verify with your passkey or authenticator code to change your password", reauthRequired: true });
    }
  } else {
    const current = String(body.currentPassword ?? "");
    if (!current || !verifyPassword(current, row.password_hash)) {
      return reply.status(403).send({ error: "Current password is incorrect" });
    }
  }
  if (verifyPassword(next, row.password_hash)) {
    return reply.status(400).send({ error: "New password must differ from the current one" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), user.id);
  return { ok: true };
});

// ---------------------------------------------------------------- user servers

function serverView(s: Server, node: Node | null, status: string) {
  return {
    id: s.id,
    name: s.name,
    userId: s.user_id,
    nodeId: s.node_id,
    node: node ? { id: node.id, name: node.name, host: node.host } : null,
    image: s.image,
    port: s.port,
    ports: JSON.parse(s.ports || "[]"),
    memoryMB: s.memory_mb,
    cpus: s.cpus,
    backupEveryHours: s.backup_every_hours,
    lastBackupAt: s.last_backup_at,
    status,
  };
}

/* ---------------------------------------------------------------- branding */

app.get("/healthz", async () => {
  return { ok: true, at: Date.now(), product: "aether-panel", core: "aether" };
});

app.get("/api/branding", async () => {
  return { branding: getBranding() };
});

app.patch("/api/admin/branding", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const body = (req.body ?? {}) as Partial<Record<string, string>>;
  const branding = setBranding(body as never);
  return { branding };
});

app.get("/api/servers", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const where = user.role === "admin" ? "" : "WHERE user_id = ?";
  const list = db
    .prepare(`SELECT * FROM servers ${where}`)
    .all(...(where ? [user.id] : [])) as Server[];
  const nodes = nodeMap();
  const st = await statuses(nodes, list);
  return {
    servers: list.map((s) => serverView(s, nodes.get(s.node_id) ?? null, st.get(s.id) ?? "unknown")),
  };
});

app.get("/api/servers/:id", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get((req.params as any).id) as
    | Server
    | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  if (user.role !== "admin" && s.user_id !== user.id) {
    return reply.status(403).send({ error: "not your server" });
  }
  const node = nodeMap().get(s.node_id) ?? null;
  const st = await statuses(new Map(node ? [[node.id, node]] : []), [s]);
  const view = serverView(s, node, st.get(s.id) ?? "unknown");
  if (user.role === "admin") view.userId = s.user_id;
  else view.userId = user.id;
  return { server: view };
});

app.post("/api/servers/:id/power", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get((req.params as any).id) as
    | Server
    | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  if (user.role !== "admin" && s.user_id !== user.id) {
    return reply.status(403).send({ error: "not your server" });
  }
  const node = nodeMap().get(s.node_id);
  if (!node) return reply.status(502).send({ error: "server's node is missing" });
  const action = ((req.body ?? {}) as any).action;
  if (!["start", "stop", "restart", "kill"].includes(action)) {
    return reply.status(400).send({ error: "invalid action" });
  }
  try {
    const res = await daemonFetch(node, `/v1/servers/${s.id}/power`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return reply.status(res.status).send({ error: await res.text() });
    return res.json();
  } catch (err: any) {
    return reply.status(502).send({ error: `node unreachable: ${err.message}` });
  }
});

// Relay live container stats from the owning node's daemon.
app.get("/api/servers/:id/stats", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get((req.params as any).id) as
    | Server
    | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  if (user.role !== "admin" && s.user_id !== user.id) {
    return reply.status(403).send({ error: "not your server" });
  }
  const node = nodeMap().get(s.node_id);
  if (!node) return reply.status(502).send({ error: "server's node is missing" });
  try {
    const res = await daemonFetch(node, `/v1/servers/${s.id}/stats`, {}, 5_000);
    if (!res.ok) return reply.status(res.status).send({ error: await res.text() });
    return res.json();
  } catch (err: any) {
    return reply.status(502).send({ error: `node unreachable: ${err.message}` });
  }
});

// ---------------------------------------------------------------- admin CRUD

function nodeMap(): Map<string, Node> {
  const rows = db.prepare("SELECT * FROM nodes").all() as Node[];
  return new Map(rows.map((n) => [n.id, n]));
}

// Per-node daemon reachability + health summary for admin node cards.
app.get("/api/admin/nodes/status", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const rows = db.prepare("SELECT * FROM nodes ORDER BY created_at").all() as Node[];
  const counts = new Map(
    (db
      .prepare("SELECT node_id, COUNT(*) AS c FROM servers GROUP BY node_id")
      .all() as Array<{ node_id: string; c: number }>).map((r) => [r.node_id, r.c]),
  );
  const nodes = await Promise.all(
    rows.map(async (n) => {
      const base = {
        id: n.id,
        name: n.name,
        host: n.host,
        daemonPort: n.daemon_port,
        serverCount: counts.get(n.id) ?? 0,
      };
      try {
        const res = await daemonFetch(n, "/healthz", {}, 3_000);
        return res.ok ? { ...base, online: true, version: await res.text() } : { ...base, online: false, version: null };
      } catch {
        return { ...base, online: false, version: null };
      }
    }),
  );
  return { nodes };
});

app.get("/api/admin/users", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at").all() as User[];
  return {
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
    })),
  };
});

app.post("/api/admin/users", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const body = (req.body ?? {}) as any;
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !body.password) return reply.status(400).send({ error: "email and password required" });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email))
    return reply.status(409).send({ error: "email already registered" });
  const user: User = {
    id: id(),
    email,
    password_hash: hashPassword(String(body.password)),
    role: body.role === "admin" ? "admin" : "user",
    created_at: now(),
  };
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(user.id, user.email, user.password_hash, user.role, user.created_at);
  return { user: publicUser(user) };
});

app.patch("/api/admin/users/:uid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const uid = (req.params as any).uid;
  const body = (req.body ?? {}) as any;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(uid) as User | undefined;
  if (!user) return reply.status(404).send({ error: "not found" });
  if (body.role) {
    if (!["admin", "user"].includes(body.role)) return reply.status(400).send({ error: "bad role" });
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(body.role, uid);
  }
  if (body.password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(String(body.password)),
      uid,
    );
  }
  if (body.email) {
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(
      String(body.email).trim().toLowerCase(),
      uid,
    );
  }
  return { user: { ...publicUser({ ...user, role: body.role ?? user.role }), email: body.email ?? user.email } };
});

app.delete("/api/admin/users/:uid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const uid = (req.params as any).uid;
  if (uid === (req as Authed).user.id)
    return reply.status(400).send({ error: "cannot delete yourself" });
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM users WHERE id = ?").run(uid);
  return { deleted: uid };
});

app.get("/api/admin/nodes", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  return { nodes: db.prepare("SELECT * FROM nodes ORDER BY created_at").all() };
});

app.post("/api/admin/nodes", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const body = (req.body ?? {}) as any;
  const name = String(body.name ?? "").trim();
  const host = String(body.host ?? "").trim();
  if (!name || !host) return reply.status(400).send({ error: "name and host are required" });
  const node: Node = {
    id: id(),
    name,
    host,
    daemon_port: Number(body.daemonPort) || 8080,
    token: String(body.token ?? "").trim(),
    created_at: now(),
  };
  db.prepare("INSERT INTO nodes (id, name, host, daemon_port, token, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    node.id,
    node.name,
    node.host,
    node.daemon_port,
    node.token,
    node.created_at,
  );
  return { node };
});

app.patch("/api/admin/nodes/:nid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const nid = (req.params as any).nid;
  const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(nid) as Node | undefined;
  if (!node) return reply.status(404).send({ error: "not found" });
  const body = (req.body ?? {}) as any;
  const upd: Partial<Node> = {
    name: body.name ? String(body.name).trim() : node.name,
    host: body.host ? String(body.host).trim() : node.host,
    daemon_port: Number(body.daemonPort) || node.daemon_port,
    token: body.token ? String(body.token).trim() : node.token,
  };
  db.prepare(
    "UPDATE nodes SET name = ?, host = ?, daemon_port = ?, token = ? WHERE id = ?",
  ).run(upd.name!, upd.host!, upd.daemon_port!, upd.token!, nid);
  return { node: { ...node, ...upd } };
});

app.delete("/api/admin/nodes/:nid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const nid = (req.params as any).nid;
  const count = (db.prepare("SELECT COUNT(*) AS c FROM servers WHERE node_id = ?").get(nid) as any)
    .c as number;
  if (count > 0) return reply.status(400).send({ error: "node still has servers" });
  db.prepare("DELETE FROM nodes WHERE id = ?").run(nid);
  return { deleted: nid };
});

// Shared egg/nest read + field parsing for the admin CRUD routes.
function eggView(e: Egg) {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    image: e.image,
    ports: JSON.parse(e.ports || "[]"),
    env: JSON.parse(e.env || "{}"),
    memoryMB: e.memory_mb,
    cpus: e.cpus,
    sort: e.sort,
    nestId: e.nest_id ?? "",
    nestName: e.nest_id
      ? (db.prepare("SELECT name FROM nests WHERE id = ?").get(e.nest_id) as Nest | undefined)?.name ?? e.nest_id
      : null,
  };
}

function safeEggFields(body: any) {
  const portsValue = body.ports ?? "[]";
  let ports: Array<{ port: number; protocol: string }>;
  try {
    const parsed = Array.isArray(portsValue) ? portsValue.filter(validPort) : JSON.parse(String(portsValue));
    if (!Array.isArray(parsed)) return null;
    ports = parsed;
  } catch {
    return null;
  }
  let env = typeof body.env === "string" ? body.env : JSON.stringify(body.env ?? {});
  env = env.trim() || "{}";
  if (!/^[\x00-\x7F]*$/.test(env) || !safeJSON(env)) return null;
  const memoryMB = Number(body.memoryMB);
  const cpus = Number(body.cpus);
  const sort = Number(body.sort ?? 100);
  return {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").slice(0, 400),
    image: String(body.image ?? "").trim(),
    ports: JSON.stringify(ports),
    env,
    memory_mb: Number.isFinite(memoryMB) && memoryMB > 0 ? Math.round(memoryMB) : 2048,
    cpus: Number.isFinite(cpus) && cpus > 0 ? cpus : 1,
    sort: Number.isFinite(sort) ? Math.round(sort) : 100,
    nest_id: String(body.nestId ?? "game-servers"),
  };
}

app.get("/api/admin/eggs", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const eggs = db.prepare("SELECT * FROM eggs ORDER BY sort, name").all() as Egg[];
  return { eggs: eggs.map(eggView) };
});

app.post("/api/admin/eggs", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const fields = safeEggFields(req.body ?? {});
  if (!fields || !fields.name || !fields.image) {
    return reply.status(400).send({ error: "name and image are required" });
  }
  const nest = db.prepare("SELECT id FROM nests WHERE id = ?").get(fields.nest_id);
  if (!nest) return reply.status(400).send({ error: "unknown nest" });
  if (db.prepare("SELECT id FROM eggs WHERE name = ?").get(fields.name)) {
    return reply.status(400).send({ error: "an egg with this name already exists" });
  }
  const eid = id();
  db.prepare(
    `INSERT INTO eggs (id, name, description, image, ports, env, memory_mb, cpus, sort, nest_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(eid, fields.name, fields.description, fields.image, fields.ports, fields.env, fields.memory_mb, fields.cpus, fields.sort, fields.nest_id);
  return reply.status(201).send({ egg: eggView(db.prepare("SELECT * FROM eggs WHERE id = ?").get(eid) as Egg) });
});

app.patch("/api/admin/eggs/:eid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const eid = (req.params as any).eid;
  const egg = db.prepare("SELECT * FROM eggs WHERE id = ?").get(eid) as Egg | undefined;
  if (!egg) return reply.status(404).send({ error: "not found" });
  const body = { ...((req.body as any) ?? {}) };
  body.name ??= egg.name;
  const fields = safeEggFields(body);
  if (!fields || !fields.name || !fields.image) {
    return reply.status(400).send({ error: "invalid egg fields" });
  }
  const dupe = db.prepare("SELECT id FROM eggs WHERE name = ? AND id != ?").get(fields.name, eid);
  if (dupe) return reply.status(400).send({ error: "an egg with this name already exists" });
  if (fields.nest_id && fields.nest_id !== (egg.nest_id ?? "")) {
    const nest = db.prepare("SELECT id FROM nests WHERE id = ?").get(fields.nest_id);
    if (!nest) return reply.status(400).send({ error: "unknown nest" });
  }
  db.prepare(
    `UPDATE eggs SET name = ?, description = ?, image = ?, ports = ?, env = ?,
     memory_mb = ?, cpus = ?, sort = ?, nest_id = ? WHERE id = ?`,
  ).run(fields.name, fields.description, fields.image, fields.ports, fields.env, fields.memory_mb, fields.cpus, fields.sort, fields.nest_id, eid);
  return { egg: eggView(db.prepare("SELECT * FROM eggs WHERE id = ?").get(eid) as Egg) };
});

app.delete("/api/admin/eggs/:eid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const eid = (req.params as any).eid;
  const egg = db.prepare("SELECT * FROM eggs WHERE id = ?").get(eid) as Egg | undefined;
  if (!egg) return reply.status(404).send({ error: "not found" });
  db.prepare("DELETE FROM eggs WHERE id = ?").run(eid);
  return { deleted: eid };
});

// ---------------------------------------------------------------- nests

app.get("/api/admin/nests", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const nests = db
    .prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM eggs e WHERE e.nest_id = n.id) AS eggCount
       FROM nests n ORDER BY n.sort, n.name`,
    )
    .all() as Array<Nest & { eggCount: number }>;
  return { nests: nests.map((n) => ({ id: n.id, name: n.name, sort: n.sort, eggCount: n.eggCount })) };
});

app.post("/api/admin/nests", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const name = String((req.body as any)?.name ?? "").trim();
  if (!name) return reply.status(400).send({ error: "name is required" });
  if (db.prepare("SELECT id FROM nests WHERE name = ?").get(name)) {
    return reply.status(400).send({ error: "a nest with this name already exists" });
  }
  const nid = id();
  db.prepare("INSERT INTO nests (id, name, sort) VALUES (?, ?, ?)").run(nid, name, 100);
  return reply.status(201).send({ nest: { id: nid, name, sort: 100 } });
});

app.patch("/api/admin/nests/:nid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const nid = (req.params as any).nid;
  const nest = db.prepare("SELECT * FROM nests WHERE id = ?").get(nid) as Nest | undefined;
  if (!nest) return reply.status(404).send({ error: "not found" });
  const name = String((req.body as any)?.name ?? nest.name).trim();
  if (!name) return reply.status(400).send({ error: "name is required" });
  if (db.prepare("SELECT id FROM nests WHERE name = ? AND id != ?").get(name, nid)) {
    return reply.status(400).send({ error: "a nest with this name already exists" });
  }
  db.prepare("UPDATE nests SET name = ? WHERE id = ?").run(name, nid);
  return { nest: { id: nid, name } };
});

app.delete("/api/admin/nests/:nid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const nid = (req.params as any).nid;
  const count = db.prepare("SELECT COUNT(*) AS c FROM eggs WHERE nest_id = ?").get(nid) as any;
  if (count.c > 0) return reply.status(400).send({ error: "nest still has eggs" });
  db.prepare("DELETE FROM nests WHERE id = ?").run(nid);
  return { deleted: nid };
});

// Validate optional fields shared by create/patch server.
function parseServerFields(body: any) {
  const env: string = typeof body.env === "string" ? body.env : JSON.stringify(body.env ?? {});
  if (!/^[\x00-\x7F]*$/.test(env) || (env && !safeJSON(env))) return null;
  let ports = "[]";
  let portsValue = body.ports ?? "[]";
  try {
    const parsed = Array.isArray(portsValue) ? portsValue.filter(validPort) : JSON.parse(portsValue);
    ports = JSON.stringify(parsed);
  } catch {
    return null;
  }
  return {
    name: String(body.name ?? "").trim(),
    user_id: String(body.userId ?? ""),
    node_id: String(body.nodeId ?? ""),
    image: String(body.image ?? "").trim(),
    env,
    ports,
    port: body.port == null ? null : Number(body.port),
    memory_mb: body.memoryMB == null ? null : Math.round(Number(body.memoryMB)),
    cpus: body.cpus == null ? null : Number(body.cpus),
    command: body.command ? String(body.command) : null,
    backup_every_hours: Math.max(0, Math.round(Number(body.backupEveryHours ?? 0))) || 0,
  };
}

function validPort(p: any) {
  return p && Number.isInteger(Number(p.port)) && Number(p.port) > 0 && Number(p.port) <= 65535 &&
    ["tcp", "udp"].includes(String(p.protocol));
}

function safeJSON(s: string) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

app.get("/api/admin/servers", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const list = db.prepare("SELECT * FROM servers ORDER BY created_at").all() as Server[];
  const nodes = nodeMap();
  const st = await statuses(nodes, list);
  return {
    servers: list.map((s) => serverView(s, nodes.get(s.node_id) ?? null, st.get(s.id) ?? "unknown")),
  };
});

app.post("/api/admin/servers", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const body = { ...((req.body as any) ?? {}) };

  // Egg presets fill in image/env/ports/cpu/memory defaults.
  if (body.eggId && body.eggId !== CUSTOM_EGG_ID) {
    const egg = db.prepare("SELECT * FROM eggs WHERE id = ?").get(String(body.eggId)) as
      | Egg
      | undefined;
    if (!egg) return reply.status(400).send({ error: "unknown egg" });
    const eggEnv = JSON.parse(egg.env || "{}");
    const userEnv = typeof body.env === "object" && body.env ? body.env : {};
    if (!body.image) body.image = egg.image;
    if (!body.ports || (Array.isArray(body.ports) && body.ports.length === 0)) {
      body.ports = JSON.parse(egg.ports || "[]");
    }
    if (body.memoryMB == null) body.memoryMB = egg.memory_mb;
    if (body.cpus == null) body.cpus = egg.cpus;
    body.env = { ...eggEnv, ...userEnv };
  }

  const fields = parseServerFields(body);
  if (!fields) return reply.status(400).send({ error: "invalid server fields" });
  if (!fields.name || !fields.image || !fields.user_id || !fields.node_id) {
    return reply
      .status(400)
      .send({ error: "name, userId, nodeId and image are required" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(fields.user_id);
  const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(fields.node_id) as Node | undefined;
  if (!user) return reply.status(400).send({ error: "unknown user" });
  if (!node) return reply.status(400).send({ error: "unknown node" });

  const server: Server = {
    id: id(),
    created_at: now(),
    last_backup_at: null,
    ...fields,
  } as unknown as Server;
  db.prepare(
    `INSERT INTO servers (id, name, user_id, node_id, image, env, ports, port, memory_mb, cpus, command, created_at, backup_every_hours, last_backup_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    server.id,
    server.name,
    server.user_id,
    server.node_id,
    server.image,
    server.env,
    server.ports,
    server.port,
    server.memory_mb,
    server.cpus,
    server.command,
    server.created_at,
    server.backup_every_hours,
    null,
  );

  // Register with the daemon so the container is created (and image pulled).
  try {
    const res = await daemonFetch(node, "/v1/servers", {
      method: "POST",
      body: JSON.stringify(specFromServer(server)),
    });
    if (!res.ok) {
      const text = await res.text();
      return reply
        .status(200)
        .send({ server, warning: `node rejected registration: ${text}` });
    }
  } catch (err: any) {
    return reply.status(200).send({
      server,
      warning: `node unreachable, server will be pushed on next power action: ${err.message}`,
    });
  }
  return { server: serverView(server, node, "created") };
});

app.patch("/api/admin/servers/:sid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const sid = (req.params as any).sid;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get(sid) as Server | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  const patch = parseServerFields({ ...s, ...(req.body ?? {}) });
  if (!patch) return reply.status(400).send({ error: "invalid server fields" });
  db.prepare(
    `UPDATE servers SET name = ?, user_id = ?, node_id = ?, image = ?, env = ?, ports = ?,
     port = ?, memory_mb = ?, cpus = ?, command = ?, backup_every_hours = ? WHERE id = ?`,
  ).run(
    patch.name,
    patch.user_id,
    patch.node_id,
    patch.image,
    patch.env,
    patch.ports,
    patch.port,
    patch.memory_mb,
    patch.cpus,
    patch.command,
    patch.backup_every_hours,
    sid,
  );
  // Push new spec to the (possibly new) node; container recreation is handled by the daemon.
  const node = nodeMap().get(patch.node_id);
  if (node) {
    try {
      const updated = db.prepare("SELECT * FROM servers WHERE id = ?").get(sid) as Server;
      await daemonFetch(node, "/v1/servers", {
        method: "POST",
        body: JSON.stringify(specFromServer(updated)),
      });
    } catch {
      /* push best-effort; power actions retry */
    }
  }
  const st = node ? await statuses(new Map([[node.id, node]]), [s]) : new Map<string, string>();
  return { server: serverView({ ...s, ...patch }, node ?? null, st.get(s.id) ?? "unknown") };
});

app.delete("/api/admin/servers/:sid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const sid = (req.params as any).sid;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get(sid) as Server | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  const node = nodeMap().get(s.node_id);
  if (node) {
    try {
      await daemonFetch(node, `/v1/servers/${s.id}`, { method: "DELETE" });
    } catch {
      /* still remove locally */
    }
  }
  db.prepare("DELETE FROM servers WHERE id = ?").run(sid);
  return { deleted: sid };
});

// ---------------------------------------------------------------- boot

const port = Number(process.env.AETHER_PANEL_PORT) || 3000;

// Serve the built client in production if it exists.
const clientDist = path.join(process.cwd(), "panel", "client", "dist");
if (fs.existsSync(clientDist)) {
  await app.register(fastifyStatic, { root: clientDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) return reply.status(404).send({ error: "not found" });
    return reply.sendFile("index.html");
  });
}

await app.ready();
setWsServer(app.server);
const addr = await app.listen({ host: "0.0.0.0", port });

console.log(`aether panel api listening on ${addr}`);
console.log(`open the client at http://localhost:${port}${fs.existsSync(clientDist) ? "" : " (dev: client on :5173)"}`);
