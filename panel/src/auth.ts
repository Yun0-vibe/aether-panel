import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db, type User } from "./db.js";

const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const COOKIE = "ae_session";

export function createSession(reply: FastifyReply, userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(token, userId, expires);
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(expires),
  });
}

export function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE];
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  reply.clearCookie(COOKIE, { path: "/" });
}

// Guard: attaches req.user for valid sessions, else rejects.
export function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const user = lookupUser(req);
  if (!user) {
    reply.status(401).send({ error: "unauthorized" });
    return false;
  }
  (req as any).user = user;
  return true;
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!requireAuth(req, reply)) return false;
  const user = (req as any).user as User;
  if (user.role !== "admin") {
    reply.status(403).send({ error: "admin only" });
    return false;
  }
  return true;
}

export function lookupUser(req: FastifyRequest): User | null {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as User | undefined;
  return row ?? null;
}

export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    displayName: u.display_name ?? u.email.split("@")[0],
    bio: u.bio ?? "",
    discordId: u.discord_id ?? null,
    createdAt: u.created_at,
  };
}
