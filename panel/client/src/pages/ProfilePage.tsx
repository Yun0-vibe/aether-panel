import React, { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useAuth, api, ApiError, type User } from "../auth/AuthContext";
import {
  IconMail, IconShield, IconKey, IconDiscord, IconCheck, IconUsers, IconLock, IconAlert, IconClose,
} from "../components/Icons";
import { RoleBadge } from "../components/RoleBadge";
import { useToast } from "../components/Toasts";

const FIELD =
  "h-[40px] w-full rounded-lg border border-border bg-[rgba(0,0,0,0.26)] px-[13px] text-[13.5px] text-white outline-none transition-all duration-150 focus:border-brand/60 focus:bg-[rgba(34,211,238,0.05)]";

function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-[8px] rounded-lg border border-red-500/30 bg-[rgba(248,113,113,0.1)] px-[13px] py-[10px] text-[12.5px] text-red-400">
      {msg}
    </div>
  );
}

function FormOk({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-[8px] rounded-lg border border-green/30 bg-[rgba(52,211,153,0.1)] px-[13px] py-[10px] text-[12.5px] text-green-400">
      <IconCheck size={15} className="flex-none" /> {msg}
    </div>
  );
}

interface PasskeyItem {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: number;
  lastUsedAt: number | null;
}

interface SessionItem {
  id: string;
  tail: string;
  expiresAt: number;
  current: boolean;
}

interface ReauthMethods {
  passkey: boolean;
  totp: boolean;
  password: boolean;
}

type ProfileTab = "profile" | "security" | "sessions";

const TABS: Array<{ id: ProfileTab; label: string; icon: React.ReactNode; sub: string }> = [
  { id: "profile", label: "Profile", icon: <IconUsers size={16} />, sub: "Bio, display name & Discord" },
  { id: "security", label: "Security", icon: <IconShield size={16} />, sub: "Password, 2FA & passkeys" },
  { id: "sessions", label: "Sessions", icon: <IconKey size={16} />, sub: "Devices signed in as you" },
];

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<ProfileTab>(() => {
    const h = (window.location.hash || "").replace("#", "") as ProfileTab;
    return TABS.some((t) => t.id === h) ? h : "profile";
  });
  useEffect(() => { window.location.hash = tab; }, [tab]);

  const proOk = useRef<string | null>(null);
  const [proMsg, setProMsg] = useState<string | null>(null);
  function flash(msg: string) { proOk.current = msg; setProMsg(msg); window.setTimeout(() => setProMsg(null), 4000); }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "—";
  const initials = (user?.displayName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-[20px]">
      {/* identity header */}
      <section className="card relative overflow-hidden flex flex-wrap items-center gap-[20px] p-[24px]">
        <div className="relative">
          <span className="avatar w-[72px] h-[72px] text-[22px] rounded-[18px] brand-grad text-[#04121c] shadow-[0_8px_28px_-8px_rgba(34,211,238,0.5)]">
            {initials}
          </span>
          <span className="absolute bottom-[6px] right-[6px] w-[14px] h-[14px] rounded-full bg-green-500 border-[2.5px] border-[#0d1424] shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[10px]">
            <h2 className="text-[19px] font-bold text-white truncate">{user?.displayName || user?.email}</h2>
            <RoleBadge role={user?.role ?? "user"} />
          </div>
          <p className="mt-[4px] text-[13px] text-text-2 truncate">{user?.email}</p>
          <div className="mt-[10px] flex flex-wrap items-center gap-[8px] text-[11.5px] text-text-3">
            <span className="inline-flex items-center gap-[6px] rounded-full border border-border bg-white/4 px-[10px] py-[3px]">
              <IconMail size={13} className="flex-none text-brand" /> Member since {memberSince}
            </span>
            {user?.discordId && (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-[rgba(88,101,242,0.4)] bg-[rgba(88,101,242,0.12)] px-[10px] py-[3px] text-[#a5adff]">
                <IconDiscord size={13} className="flex-none" /> {user.discordUsername ?? "Discord linked"}
              </span>
            )}
            {user?.totpEnabled ? (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-green/30 bg-[rgba(52,211,153,0.1)] px-[10px] py-[3px] text-green-400">
                <IconShield size={13} className="flex-none" /> 2FA on
              </span>
            ) : null}
            {proMsg && (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-green/30 bg-[rgba(52,211,153,0.1)] px-[10px] py-[3px] text-green-400">
                <IconCheck size={13} className="flex-none" /> {proMsg}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* sub-page nav */}
      <nav className="grid grid-cols-1 gap-[10px] sm:grid-cols-3" aria-label="Account pages">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className={`flex items-center gap-[12px] rounded-[16px] border px-[16px] py-[13px] text-left transition-all duration-200 hover:-translate-y-[2px] ${
              tab === t.id
                ? "border-brand/45 bg-brand/10 shadow-[0_14px_30px_-18px_rgba(34,211,238,0.6)]"
                : "border-border bg-surface hover:border-brand/30"
            }`}
          >
            <span className={`grid h-9 w-9 flex-none place-items-center rounded-[11px] border ${tab === t.id ? "border-brand/40 bg-brand/12 text-brand" : "border-border bg-white/4 text-text-3"}`}>
              {t.icon}
            </span>
            <span className="min-w-0">
              <span className={`block text-[13.5px] font-bold ${tab === t.id ? "text-white" : "text-text-2"}`}>{t.label}</span>
              <span className="block trunc text-[11px] text-text-3">{t.sub}</span>
            </span>
          </button>
        ))}
      </nav>

      {tab === "profile" && <ProfileTabMain flash={flash} />}
      {tab === "security" && <SecurityTabMain flash={flash} />}
      {tab === "sessions" && <SessionsTabMain />}
    </div>
  );
}

/* =================Profile tab */

function ProfileTabMain({ flash }: { flash: (m: string) => void }) {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [discordSetup, setDiscordSetup] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);
  const [discErr, setDiscErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ enabled?: boolean }>("/api/auth/discord/status").then((d) => setDiscordSetup(Boolean(d.enabled))).catch(() => {});
    const q = new URLSearchParams(window.location.search);
    const d = q.get("discord");
    if (d) window.history.replaceState({}, "", "/profile");
    if (d === "linked") flash("Discord account linked");
    if (d === "taken") setDiscErr("That Discord account is already linked to another panel user.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlinkDiscord() {
    setDiscErr(null); setDiscBusy(true);
    try {
      const d = await api<{ user: User }>("/api/account/discord/unlink", { method: "POST" });
      setUser(d.user);
      toast.push("Discord unlinked", "success");
    } catch (e) { setDiscErr(e instanceof ApiError ? e.message : "Failed to unlink"); }
    finally { setDiscBusy(false); }
  }

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setBio(user?.bio ?? "");
  }, [user]);

  const [proBusy, setProBusy] = useState(false);
  const [proErr, setProErr] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProErr(null); flash(""); setProBusy(true);
    try {
      const d = await api<{ user: User }>("/api/account", {
        method: "PATCH",
        body: { displayName, bio },
      });
      setUser(d.user);
      flash("Profile saved");
    } catch (e) {
      setProErr(e instanceof ApiError ? e.message : "Failed to save profile");
    } finally { setProBusy(false); }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-[20px] xl:grid-cols-2">
      <section className="card">
        <div className="mb-[18px] flex items-center gap-[10px]">
          <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconUsers size={16} /></span>
          <div>
            <h3 className="text-[15px] font-bold">About you</h3>
            <p className="text-[11.5px] text-text-3">Display name and bio, shown across the panel.</p>
          </div>
        </div>
        <form onSubmit={saveProfile} className="flex flex-col gap-[15px]">
          <label className="flex flex-col gap-[7px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Display name</span>
            <input className={FIELD} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={48} placeholder="e.g. Ninja" />
          </label>
          <label className="flex flex-col gap-[7px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">About you</span>
            <textarea
              className="min-h-[84px] w-full resize-y rounded-lg border border-border bg-[rgba(0,0,0,0.26)] px-[13px] py-[10px] text-[13.5px] leading-[1.6] text-white outline-none transition-all duration-150 focus:border-brand/60"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              placeholder="A short bio (max 280 characters)"
            />
          </label>
          <FormError msg={proErr} />
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={proBusy}>
              {proBusy ? <span className="btn-spinner" /> : null} Save profile
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-col gap-[20px]">
        <section className="card">
          <div className="mb-[16px] flex items-center gap-[10px]">
            <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-[rgba(88,101,242,0.4)] bg-[rgba(88,101,242,0.14)] text-[#aab4ff]"><IconDiscord size={16} /></span>
            <div>
              <h3 className="text-[15px] font-bold">Discord</h3>
              <p className="text-[11.5px] text-text-3">Link once, then sign in with Discord.</p>
            </div>
          </div>
          {user?.discordId ? (
            <div className="flex flex-wrap items-center gap-[12px] rounded-xl border border-[rgba(88,101,242,0.35)] bg-[rgba(88,101,242,0.1)] p-[14px]">
              {user.discordAvatar && (
                <img src={user.discordAvatar} alt="" className="h-10 w-10 flex-none rounded-full ring-2 ring-[rgba(88,101,242,0.5)]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-white">{user.discordUsername ?? user.discordId}</p>
                <p className="font-mono text-[11px] text-text-3">{user.discordId}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => void unlinkDiscord()} disabled={discBusy}>
                {discBusy ? <span className="btn-spinner" /> : null} Unlink
              </button>
            </div>
          ) : discordSetup ? (
            <a
              href="/api/auth/discord"
              className="btn btn-block gap-[10px] !bg-[#5865F2] !text-white !border-[#5865F2] hover:!bg-[#4752C4] transition-colors"
            >
              <IconDiscord size={16} className="flex-none" /> Link with Discord
            </a>
          ) : (
            <p className="flex items-center gap-[8px] rounded-lg border border-yellow-500/30 bg-[rgba(250,204,21,0.08)] px-[13px] py-[10px] text-[12.5px] text-yellow-300">
              <IconAlert size={15} className="flex-none" /> Discord sign-in isn't configured on this server yet (needs DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET in .env).
            </p>
          )}
          <FormError msg={discErr} />
        </section>

        <section className="card">
          <div className="mb-[14px] flex items-center gap-[10px]">
            <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconLock size={16} /></span>
            <div>
              <h3 className="text-[15px] font-bold">Account details</h3>
              <p className="text-[11.5px] text-text-3">Fixed identifiers for your account.</p>
            </div>
          </div>
          <dl className="flex flex-col divide-y divide-[rgba(255,255,255,0.06)]">
            <InfoRow label="Email" value={user?.email ?? "—"} />
            <InfoRow label="Role" value={user?.role === "admin" ? "Administrator" : "Standard user"} />
            <InfoRow label="User ID" value={user?.id ?? "—"} mono />
          </dl>
        </section>
      </div>
    </div>
  );
}

/* =================Security tab — step-up locked */

function SecurityTabMain({ flash }: { flash: (m: string) => void }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [reauthToken, setReauthToken] = useState<string | null>(null);
  const [reauthExp, setReauthExp] = useState(0);
  const [methods, setMethods] = useState<ReauthMethods | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockErr, setUnlockErr] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [pwVerify, setPwVerify] = useState("");

  const locked = reauthToken === null || reauthExp <= Date.now();

  const loadMethods = useCallback(() => {
    api<ReauthMethods>("/api/account/reauth/methods").then(setMethods).catch(() => setMethods({ passkey: false, totp: false, password: true }));
  }, []);

  useEffect(() => { loadMethods(); }, [loadMethods]);

  const onVerified = useCallback((token: string, expiresIn: number) => {
    unlock(token, expiresIn);
    flash("");
  }, []);

  const [showTotpSetup, setShowTotpSetup] = useState(false);

  async function bootstrapPasskey() {
    setUnlockErr(null); setUnlockBusy(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { options } = await api<{ options: Record<string, unknown> }>("/api/account/passkeys/options", { method: "POST", noRedirect: true });
      const attResp = await startRegistration({ optionsJSON: options as never });
      const d = await api<{ reauthToken: string; expiresIn: number }>("/api/account/passkeys/register", { method: "POST", body: { response: attResp }, noRedirect: true });
      unlock(d.reauthToken, d.expiresIn);
      flash("Passkey added — security unlocked");
    } catch (e) {
      setUnlockErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not add passkey");
    } finally { setUnlockBusy(false); }
  }

  // Auto-lock countdown check.
  useEffect(() => {
    if (!reauthToken) return;
    const t = window.setInterval(() => setReauthExp((e) => e), 15_000);
    return () => window.clearInterval(t);
  }, [reauthToken]);

  function unlock(token: string, expiresIn: number) {
    setReauthToken(token);
    setReauthExp(Date.now() + expiresIn);
    setTotpCode(""); setPwVerify("");
    setUnlockErr(null);
  }

  async function verifyTotpUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockErr(null); setUnlockBusy(true);
    try {
      const d = await api<{ reauthToken: string; expiresIn: number }>("/api/account/reauth/verify", { method: "POST", body: { totp: totpCode }, noRedirect: true });
      unlock(d.reauthToken, d.expiresIn);
    } catch (e) { setUnlockErr(e instanceof ApiError ? e.message : "Verification failed"); }
    finally { setUnlockBusy(false); }
  }

  async function verifyPasswordUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockErr(null); setUnlockBusy(true);
    try {
      const d = await api<{ reauthToken: string; expiresIn: number }>("/api/account/reauth/verify", { method: "POST", body: { password: pwVerify }, noRedirect: true });
      unlock(d.reauthToken, d.expiresIn);
    } catch (e) { setUnlockErr(e instanceof ApiError ? e.message : "Verification failed"); }
    finally { setUnlockBusy(false); }
  }

  async function verifyPasskeyUnlock() {
    setUnlockErr(null); setUnlockBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { options } = await api<{ options: Record<string, unknown> }>("/api/account/reauth/begin", { method: "POST" });
      const attResp = await startAuthentication({ optionsJSON: options as never });
      const d = await api<{ reauthToken: string; expiresIn: number }>("/api/account/reauth/verify", { method: "POST", body: { response: attResp }, noRedirect: true });
      unlock(d.reauthToken, d.expiresIn);
    } catch (e) {
      setUnlockErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Verification failed");
    } finally { setUnlockBusy(false); }
  }

  if (locked) {
    return (
      <section className="card mx-auto max-w-[520px] rise flex flex-col items-center gap-[16px] py-[36px] px-[26px] text-center">
        <span className="grid h-[64px] w-[64px] place-items-center rounded-[20px] border border-brand/35 bg-brand/10 text-brand shadow-[0_0_34px_-8px_rgba(34,211,238,0.5)]">
          <IconLock size={28} />
        </span>
        <div>
          <h3 className="text-[17px] font-bold">Security is locked</h3>
          <p className="mt-[6px] text-[12.5px] leading-[1.6] text-text-2">
            Password changes, 2FA settings and your passkeys are hidden until you verify it's really you with your <b>passkey</b> or <b>authenticator app</b>.
          </p>
        </div>

        {methods?.passkey && (
          <button className="btn btn-primary btn-lg btn-block gap-[10px] animate-[fade-up_480ms_var(--ease)]" onClick={() => void verifyPasskeyUnlock()} disabled={unlockBusy}>
            <Fingerprint size={16} className="flex-none" />
            Verify with a passkey
          </button>
        )}

        {methods?.totp && (
          <form onSubmit={verifyTotpUnlock} className="flex w-full flex-col gap-[10px]">
            <input
              className={FIELD + " text-center tracking-[0.35em]"}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder={methods.passkey ? "…or enter the 6-digit code" : "6-digit authenticator code"}
              required={!(methods.passkey && !totpCode && !unlockBusy)}
            />
            <button className="btn btn-primary" disabled={unlockBusy || totpCode.length < 6}>
              {unlockBusy ? <span className="btn-spinner" /> : null} Verify with authenticator
            </button>
          </form>
        )}

        {methods && !methods.passkey && !methods.totp && methods.password && (
          <>
            <form onSubmit={verifyPasswordUnlock} className="flex w-full flex-col gap-[10px]">
              <input className={FIELD} type="password" value={pwVerify} onChange={(e) => setPwVerify(e.target.value)} placeholder="Current password" required autoComplete="current-password" />
              <button className="btn btn-primary" disabled={unlockBusy}>{unlockBusy ? <span className="btn-spinner" /> : null} Unlock security settings</button>
            </form>
            <div className="flex w-full items-center gap-[10px]">
              <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-3">Or set up a verification method</span>
              <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
            </div>
            <div className="grid w-full grid-cols-1 gap-[10px] sm:grid-cols-2">
              <button className="btn" onClick={() => { setShowTotpSetup((v) => !v); setUnlockErr(null); }}>
                Authenticator app
              </button>
              <button className="btn" onClick={() => void bootstrapPasskey()} disabled={unlockBusy}>
                {unlockBusy ? <span className="btn-spinner" /> : null} Add a passkey
              </button>
            </div>
            {showTotpSetup && (
              <div className="w-full text-left">
                <TotpCard user={user} setUser={setUser} reauthToken={null} onVerified={onVerified} />
              </div>
            )}
            <p className="text-[11px] text-text-3">Setting either one up also unlocks security for 10 minutes.</p>
          </>
        )}

        <FormError msg={unlockErr} />
        <p className="text-[11px] text-text-3">Verification stays valid for 10 minutes.</p>
      </section>
    );
  }

  return (
    <div className="rise flex flex-col gap-[20px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[14px] border border-green/30 bg-[rgba(52,211,153,0.07)] px-[16px] py-[10px]">
        <span className="flex items-center gap-[8px] text-[12.5px] text-green-400"><IconCheck size={15} className="flex-none" /> Identity verified — security settings unlocked for 10 minutes</span>
        <button className="btn btn-sm" onClick={() => { setReauthToken(null); setReauthExp(0); flash(""); toast.push("Security re-locked", "success"); }}>Lock now</button>
      </div>
      <div className="grid grid-cols-1 items-start gap-[20px] xl:grid-cols-2">
        <PasswordCard reauthToken={reauthToken} onReauthRejected={() => { setReauthToken(null); setReauthExp(0); }} flash={flash} />
        <div className="flex flex-col gap-[20px]">
          <TotpCard user={user} setUser={setUser} reauthToken={reauthToken} onVerified={onVerified} />
          <PasskeysCard reauthToken={reauthToken} onReauthRejected={() => { setReauthToken(null); setReauthExp(0); }} onVerified={onVerified} />
        </div>
      </div>
    </div>
  );
}

/* ============ password */

function PasswordCard({ reauthToken, onReauthRejected, flash }: { reauthToken: string | null; onReauthRejected: () => void; flash: (m: string) => void }) {
  const [newPass, setNewPass] = useState("");
  const [repeatPass, setRepeatPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newPass !== repeatPass) { setErr("New passwords do not match"); return; }
    setBusy(true);
    try {
      await api("/api/account/password", {
        method: "POST",
        body: { newPassword: newPass },
        noRedirect: true,
        headers: reauthToken ? { "X-Ae-Reauth": reauthToken } : undefined,
      });
      setNewPass(""); setRepeatPass("");
      flash("Password changed");
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { reauthRequired?: boolean } | null) : null;
      if (e instanceof ApiError && e.status === 403 && body?.reauthRequired) { onReauthRejected(); setErr("Verification expired — unlock again."); }
      else setErr(e instanceof ApiError ? e.message : "Failed to change password");
    } finally { setBusy(false); }
  }

  return (
    <section className="card">
      <div className="mb-[18px] flex items-center gap-[10px]">
        <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconKey size={16} /></span>
        <div>
          <h3 className="text-[15px] font-bold">Change password</h3>
          <p className="text-[11.5px] text-text-3">Verified by your passkey / authenticator — not the old password.</p>
        </div>
      </div>
      <form onSubmit={changePassword} className="flex flex-col gap-[15px]">
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">New password</span>
          <input className={FIELD} type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={6} autoComplete="new-password" />
        </label>
        <label className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Repeat new password</span>
          <input className={FIELD} type="password" value={repeatPass} onChange={(e) => setRepeatPass(e.target.value)} required autoComplete="new-password" />
        </label>
        <FormError msg={err} />
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="btn-spinner" /> : null} Change password
          </button>
        </div>
      </form>
    </section>
  );
}

/* ============ 2fa */

function TotpCard({ user, setUser, reauthToken, onVerified }: { user: User | null; setUser: (u: User | null) => void; reauthToken: string | null; onVerified?: (token: string, expiresIn: number) => void }) {
  const toast = useToast();
  const [modal, setModal] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [disablePass, setDisablePass] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  async function start2fa() {
    setErr(null); setBusy(true);
    try {
      const d = await api<{ qr: string; secret: string }>("/api/account/totp/setup", { method: "POST", headers: reauthToken ? { "X-Ae-Reauth": reauthToken } : undefined });
      setModal({ qr: d.qr, secret: d.secret });
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed to start 2FA setup"); }
    finally { setBusy(false); }
  }

  async function confirm2fa(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const d = await api<{ user: User; reauthToken?: string; expiresIn?: number }>("/api/account/totp/enable", { method: "POST", body: { code }, noRedirect: true });
      setUser(d.user);
      setModal(null);
      setCode("");
      toast.push("Two-factor authentication enabled", "success");
      if (d.reauthToken) onVerified?.(d.reauthToken, d.expiresIn ?? 600_000);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Invalid code"); }
    finally { setBusy(false); }
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const d = await api<{ user: User }>("/api/account/totp/disable", { method: "POST", body: { password: disablePass }, noRedirect: true });
      setUser(d.user);
      setDisablePass("");
      setShowDisable(false);
      toast.push("Two-factor authentication disabled", "success");
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Wrong password"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <section className="card">
        <div className="mb-[16px] flex items-center gap-[10px]">
          <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-green-400"><IconShield size={16} /></span>
          <div>
            <h3 className="text-[15px] font-bold">Authenticator app (2FA)</h3>
            <p className="text-[11.5px] text-text-3">Time-based codes — Google Authenticator, Authy, 1Password…</p>
          </div>
        </div>
        {user?.totpEnabled ? (
          showDisable ? (
            <form onSubmit={disable2fa} className="flex flex-col gap-[12px]">
              <input className={FIELD} type="password" value={disablePass} onChange={(e) => setDisablePass(e.target.value)} required autoComplete="current-password" placeholder="Confirm password to disable 2FA" />
              <div className="flex justify-between">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDisable(false)}>Keep 2FA</button>
                <button type="submit" className="btn btn-sm !border-red-500/40 !text-red-400 hover:!bg-[rgba(248,113,113,0.1)]" disabled={busy}>
                  {busy ? <span className="btn-spinner" /> : null} Disable 2FA
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-[10px]">
              <span className="flex items-center gap-[8px] text-[12.5px] text-green-400"><IconCheck size={15} className="flex-none" /> 2FA is active on this account</span>
              <button className="btn btn-sm !border-red-500/30 !text-red-400" onClick={() => setShowDisable(true)}>Disable</button>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-[10px]">
            <p className="text-[12.5px] text-text-2">Add a second step at sign-in — even if your password leaks, your account stays safe.</p>
            <div className="flex justify-end">
              <button className="btn btn-primary btn-sm" onClick={() => void start2fa()} disabled={busy}>
                {busy ? <span className="btn-spinner" /> : null} Enable 2FA
              </button>
            </div>
          </div>
        )}
        <div className="mt-[10px]"><FormError msg={err} /></div>
      </section>

      {modal && (
        <Modal title="Set up your authenticator app" onClose={() => { setModal(null); setCode(""); }}>
          <div className="flex flex-col gap-[14px]">
            <div className="flex flex-wrap items-center gap-[16px]">
              <img src={modal.qr} alt="2FA QR code" className="h-[150px] w-[150px] flex-none rounded-xl border border-border bg-[#0d1424] p-[8px]" />
              <div className="min-w-[180px] flex-1">
                <p className="text-[12.5px] leading-[1.6] text-text-2">Scan the QR with your authenticator app. No camera? Type this secret manually:</p>
                <p className="mono mt-[8px] break-all rounded-lg border border-border bg-[rgba(0,0,0,0.3)] px-[10px] py-[7px] text-[12.5px] text-white">{modal.secret}</p>
              </div>
            </div>
            <form onSubmit={confirm2fa} className="flex flex-col gap-[10px]">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Enter the 6-digit code to confirm</span>
                <input
                  className={FIELD + " text-center tracking-[0.35em]"}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                />
              </label>
              <FormError msg={err} />
              <div className="flex justify-end gap-[9px]">
                <button type="button" className="btn btn-ghost" onClick={() => { setModal(null); setCode(""); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? <span className="btn-spinner" /> : null} Enable 2FA
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ============ passkeys */

function PasskeysCard({ reauthToken, onReauthRejected, onVerified }: { reauthToken: string | null; onReauthRejected: () => void; onVerified?: (token: string, expiresIn: number) => void }) {
  const toast = useToast();
  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const H = reauthToken ? { "X-Ae-Reauth": reauthToken } : undefined;

  const load = useCallback(() => {
    if (!H) { setPasskeys(null); return; }
    api<{ passkeys?: PasskeyItem[] }>("/api/account/passkeys", { headers: H })
      .then((d) => setPasskeys(d.passkeys ?? []))
      .catch((e) => {
        const body = e instanceof ApiError ? (e.body as { reauthRequired?: boolean } | null) : null;
        if (e instanceof ApiError && body?.reauthRequired) onReauthRejected();
        else setPasskeys([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reauthToken]);

  useEffect(() => { load(); }, [load]);

  async function addPasskey() {
    setErr(null); setBusy(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { options } = await api<{ options: Record<string, unknown> }>("/api/account/passkeys/options", { method: "POST", headers: H });
      const attResp = await startRegistration({ optionsJSON: options as never });
      const d = await api<{ passkeys: PasskeyItem[]; reauthToken?: string; expiresIn?: number }>("/api/account/passkeys/register", { method: "POST", body: { response: attResp }, noRedirect: true, headers: H });
      setPasskeys(d.passkeys);
      toast.push("Passkey added", "success");
      if (d.reauthToken) onVerified?.(d.reauthToken, d.expiresIn ?? 600_000);
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { reauthRequired?: boolean } | null) : null;
      if (e instanceof ApiError && body?.reauthRequired) onReauthRejected();
      else toast.pushError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Passkey registration failed");
    } finally { setBusy(false); }
  }

  async function deletePasskey(p: PasskeyItem) {
    if (!window.confirm(`Remove ${p.name}? You won't be able to sign in with it.`)) return;
    try {
      const d = await api<{ passkeys: PasskeyItem[] }>(`/api/account/passkeys/${encodeURIComponent(p.id)}`, { method: "DELETE", headers: H });
      setPasskeys(d.passkeys);
      toast.push("Passkey removed", "success");
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { reauthRequired?: boolean } | null) : null;
      if (e instanceof ApiError && body?.reauthRequired) onReauthRejected();
      else toast.pushError(e);
    }
  }

  return (
    <section className="card">
      <div className="mb-[16px] flex items-center gap-[10px]">
        <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconLock size={16} /></span>
        <div>
          <h3 className="text-[15px] font-bold">Passkeys</h3>
          <p className="text-[11.5px] text-text-3">Fingerprint / Face ID / Windows Hello — passwordless sign-in.</p>
        </div>
      </div>
      <div className="flex flex-col gap-[10px]">
        {passkeys !== null && passkeys.length === 0 && (
          <p className="text-[12.5px] text-text-2">No passkeys yet. Add one to sign in with your fingerprint, face or device PIN — no password needed.</p>
        )}
        {(passkeys ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-[12px] rounded-xl border border-border bg-white/4 px-[14px] py-[11px]">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-brand/30 bg-brand/10 text-brand"><IconKey size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{p.name}</p>
              <p className="text-[10.5px] text-text-3">
                Added {new Date(p.createdAt).toLocaleDateString()} · {p.backedUp ? "synced" : "this device only"}{p.lastUsedAt ? ` · last used ${new Date(p.lastUsedAt).toLocaleDateString()}` : ""}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm !border-red-500/30 !text-red-400" onClick={() => void deletePasskey(p)}>Remove</button>
          </div>
        ))}
        <div className="flex justify-end">
          <button className="btn btn-primary btn-sm" onClick={() => void addPasskey()} disabled={busy}>
            {busy ? <span className="btn-spinner" /> : null} Add a passkey
          </button>
        </div>
      </div>
      <div className="mt-[10px]"><FormError msg={err} /></div>
    </section>
  );
}

/* ============ sessions tab */

function SessionsTabMain() {
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    api<{ sessions?: SessionItem[] }>("/api/account/sessions").then((d) => setSessions(d.sessions ?? [])).catch(() => setSessions([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke(s: SessionItem) {
    try {
      await api(`/api/account/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" });
      setSessions((list) => (list ?? []).filter((x) => x.id !== s.id));
      toast.push("Session signed out", "success");
    } catch (e) { toast.pushError(e); }
  }

  async function revokeOthers() {
    if (!window.confirm("Sign out every other device? You stay signed in here.")) return;
    try {
      await api("/api/account/sessions/revoke-others", { method: "POST" });
      load();
      toast.push("All other sessions signed out", "success");
    } catch (e) { toast.pushError(e); }
  }

  return (
    <section className="card rise">
      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-[10px]">
        <div className="flex items-center gap-[10px]">
          <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconKey size={16} /></span>
          <div>
            <h3 className="text-[15px] font-bold">Active sessions</h3>
            <p className="text-[11.5px] text-text-3">{sessions?.length ?? 0} device{(sessions?.length ?? 0) === 1 ? "" : "s"} signed in as you</p>
          </div>
        </div>
        <button className="btn btn-sm !border-red-500/30 !text-red-400" onClick={() => void revokeOthers()}>Sign out everywhere else</button>
      </div>
      <div className="flex flex-col gap-[8px]">
        {sessions === null && <p className="py-[10px] text-[12.5px] text-text-3">Loading sessions…</p>}
        {sessions !== null && sessions.length === 0 && <p className="py-[10px] text-[12.5px] text-text-3">No active sessions.</p>}
        {(sessions ?? []).map((s) => (
          <div key={s.id} className={`flex items-center gap-[12px] rounded-xl border px-[14px] py-[11px] ${s.current ? "border-green/30 bg-[rgba(52,211,153,0.06)]" : "border-border bg-white/4"}`}>
            <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] border ${s.current ? "border-green/35 bg-[rgba(52,211,153,0.12)] text-green-400" : "border-border bg-white/4 text-text-3"}`}>
              <IconMail size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-[8px] text-[13px] font-semibold text-white">
                Session ·{s.tail.toUpperCase()}
                {s.current && <span className="rounded-full border border-green/35 bg-[rgba(52,211,153,0.12)] px-[8px] py-[1px] text-[9.5px] font-bold uppercase tracking-wider text-green-400">This device</span>}
              </p>
              <p className="text-[10.5px] text-text-3">Expires {new Date(s.expiresAt).toLocaleString()}</p>
            </div>
            {!s.current && (
              <button className="btn btn-ghost btn-sm !border-red-500/30 !text-red-400" onClick={() => void revoke(s)}>Revoke</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ shared */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#03060e]/70 p-4 backdrop-blur-[10px] animate-[fade-in_220ms_var(--ease)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-[22px] border border-white/12 bg-gradient-to-b from-[rgba(18,25,43,0.97)] to-[rgba(12,17,31,0.97)] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] animate-[modal-in_300ms_var(--ease)]">
        <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border bg-[rgba(18,25,43,0.96)] px-5 py-4 backdrop-blur-md">
          <h3 className="text-sm font-bold">{title}</h3>
          <button className="flex h-8 w-8 flex-none place-items-center rounded-md text-text-3 transition-colors hover:bg-white/5 hover:text-white" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[11px]">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-text-3">{label}</dt>
      <dd className={`min-w-0 truncate text-[13px] ${mono ? "font-mono text-text-2" : "text-white"}`}>{value}</dd>
    </div>
  );
}
