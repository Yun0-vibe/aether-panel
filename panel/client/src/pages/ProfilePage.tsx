import React, { useEffect, useState } from "react";
import { useAuth, api, ApiError } from "../auth/AuthContext";
import {
  IconMail, IconShield, IconKey, IconDiscord, IconCheck, IconUsers, IconLock, IconAlert,
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

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [profileBusy, setProfileBusy] = useState(false);
  const [proErr, setProErr] = useState<string | null>(null);
  const [proOk, setProOk] = useState<string | null>(null);

  /* -------- discord oauth -------- */
  const [discordSetup, setDiscordSetup] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);
  const [discErr, setDiscErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ enabled?: boolean }>("/api/auth/discord/status").then((d) => setDiscordSetup(Boolean(d.enabled))).catch(() => {});
    const q = new URLSearchParams(window.location.search);
    const d = q.get("discord");
    if (d) window.history.replaceState({}, "", "/profile");
    if (d === "linked") setProOk("Discord account linked");
    if (d === "taken") setDiscErr("That Discord account is already linked to another panel user.");
  }, []);

  async function unlinkDiscord() {
    setDiscErr(null); setDiscBusy(true);
    try {
      const d = await api<{ user: NonNullable<typeof user> }>("/api/account/discord/unlink", { method: "POST" });
      setUser(d.user);
      toast.push("Discord unlinked", "success");
    } catch (e) { setDiscErr(e instanceof ApiError ? e.message : "Failed to unlink"); }
    finally { setDiscBusy(false); }
  }

  /* -------- 2fa (totp) -------- */
  const [totpSetup, setTotpSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpDisablePass, setTotpDisablePass] = useState("");
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpMsg, setTotpMsg] = useState<string | null>(null);
  const [totpErr, setTotpErr] = useState<string | null>(null);

  async function start2fa() {
    setTotpErr(null); setTotpMsg(null); setTotpBusy(true);
    try {
      const d = await api<{ qr: string; secret: string }>("/api/account/totp/setup", { method: "POST" });
      setTotpSetup({ qr: d.qr, secret: d.secret });
    } catch (e) { setTotpErr(e instanceof ApiError ? e.message : "Failed to start 2FA setup"); }
    finally { setTotpBusy(false); }
  }

  async function confirm2fa(e: React.FormEvent) {
    e.preventDefault();
    setTotpErr(null); setTotpBusy(true);
    try {
      const d = await api<{ user: NonNullable<typeof user> }>("/api/account/totp/enable", { method: "POST", body: { code: totpCode }, noRedirect: true });
      setUser(d.user);
      setTotpSetup(null);
      setTotpCode("");
      setTotpMsg("2FA enabled — you'll be asked for a code at every sign-in.");
      toast.push("Two-factor authentication enabled", "success");
    } catch (e) { setTotpErr(e instanceof ApiError ? e.message : "Invalid code"); }
    finally { setTotpBusy(false); }
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setTotpErr(null); setTotpMsg(null); setTotpBusy(true);
    try {
      const d = await api<{ user: NonNullable<typeof user> }>("/api/account/totp/disable", { method: "POST", body: { password: totpDisablePass }, noRedirect: true });
      setUser(d.user);
      setTotpDisablePass("");
      setTotpMsg("2FA disabled");
      toast.push("Two-factor authentication disabled", "success");
    } catch (e) { setTotpErr(e instanceof ApiError ? e.message : "Wrong password"); }
    finally { setTotpBusy(false); }
  }

  /* -------- passkeys -------- */
  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null);
  const [pkBusy, setPkBusy] = useState(false);

  useEffect(() => {
    api<{ passkeys?: PasskeyItem[] }>("/api/account/passkeys").then((d) => setPasskeys(d.passkeys ?? [])).catch(() => setPasskeys([]));
  }, []);

  async function addPasskey() {
    setPkBusy(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { options } = await api<{ options: Record<string, unknown> }>("/api/account/passkeys/options", { method: "POST" });
      const attResp = await startRegistration({ optionsJSON: options as never });
      const d = await api<{ passkeys: PasskeyItem[] }>("/api/account/passkeys/register", { method: "POST", body: { response: attResp }, noRedirect: true });
      setPasskeys(d.passkeys);
      toast.push("Passkey added", "success");
    } catch (e) {
      toast.pushError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Passkey registration failed");
    } finally { setPkBusy(false); }
  }

  async function deletePasskey(p: PasskeyItem) {
    if (!window.confirm(`Remove ${p.name}? You won't be able to sign in with it.`)) return;
    try {
      const d = await api<{ passkeys: PasskeyItem[] }>(`/api/account/passkeys/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      setPasskeys(d.passkeys);
      toast.push("Passkey removed", "success");
    } catch (e) { toast.pushError(e); }
  }

  /* -------- profile form -------- */
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setBio(user?.bio ?? "");
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProErr(null); setProOk(null); setProfileBusy(true);
    try {
      const d = await api<{ user: NonNullable<typeof user> }>("/api/account", {
        method: "PATCH",
        body: { displayName, bio },
      });
      setUser(d.user);
      setProOk("Profile saved");
    } catch (e) {
      setProErr(e instanceof ApiError ? e.message : "Failed to save profile");
    } finally { setProfileBusy(false); }
  }

  /* -------- password form -------- */
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [repeatPass, setRepeatPass] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null); setPwOk(null);
    if (newPass !== repeatPass) { setPwErr("New passwords do not match"); return; }
    setPwBusy(true);
    try {
      await api("/api/account/password", {
        method: "POST",
        body: { currentPassword: curPass, newPassword: newPass },
        noRedirect: true,
      });
      setPwOk("Password changed");
      setCurPass(""); setNewPass(""); setRepeatPass("");
    } catch (e) {
      setPwErr(e instanceof ApiError ? e.message : "Failed to change password");
    } finally { setPwBusy(false); }
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "—";
  const initials = (user?.displayName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-[20px]">
      {/* identity header */}
      <section className="card relative overflow-hidden flex flex-wrap items-center gap-[20px] p-[24px]">
        {user?.discordAvatar && (
          <img src={user.discordAvatar} alt="" className="absolute top-0 right-0 h-full w-[220px] object-cover opacity-[0.06] pointer-events-none" />
        )}
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
            {user?.discordId ? (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-[rgba(88,101,242,0.4)] bg-[rgba(88,101,242,0.12)] px-[10px] py-[3px] text-[#a5adff]">
                <IconDiscord size={13} className="flex-none" /> {user.discordUsername ?? "Discord linked"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-border bg-white/4 px-[10px] py-[3px]">
                <IconDiscord size={13} className="flex-none text-text-3" /> Discord not linked
              </span>
            )}
            {user?.totpEnabled ? (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-green/30 bg-[rgba(52,211,153,0.1)] px-[10px] py-[3px] text-green-400">
                <IconShield size={13} className="flex-none" /> 2FA on
              </span>
            ) : null}
            {(passkeys?.length ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-border bg-white/4 px-[10px] py-[3px]">
                <IconKey size={13} className="flex-none text-brand" /> {passkeys?.length} passkey{(passkeys?.length ?? 0) === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-[20px] xl:grid-cols-2">
        {/* profile edit */}
        <div className="flex flex-col gap-[20px]">
          <section className="card">
            <div className="mb-[18px] flex items-center gap-[10px]">
              <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconUsers size={16} /></span>
              <div>
                <h3 className="text-[15px] font-bold">Profile</h3>
                <p className="text-[11.5px] text-text-3">How you appear across the panel.</p>
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
              <FormOk msg={proOk} />
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={profileBusy}>
                  {profileBusy ? <span className="btn-spinner" /> : null} Save profile
                </button>
              </div>
            </form>
          </section>

          {/* discord connect */}
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
        </div>

        <div className="flex flex-col gap-[20px]">
          {/* password */}
          <section className="card">
            <div className="mb-[18px] flex items-center gap-[10px]">
              <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconKey size={16} /></span>
              <div>
                <h3 className="text-[15px] font-bold">Password</h3>
                <p className="text-[11.5px] text-text-3">Change your panel password.</p>
              </div>
            </div>
            <form onSubmit={changePassword} className="flex flex-col gap-[15px]">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Current password</span>
                <input className={FIELD} type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} required autoComplete="current-password" />
              </label>
              <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
                <label className="flex flex-col gap-[7px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">New password</span>
                  <input className={FIELD} type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={6} autoComplete="new-password" />
                </label>
                <label className="flex flex-col gap-[7px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Repeat new password</span>
                  <input className={FIELD} type="password" value={repeatPass} onChange={(e) => setRepeatPass(e.target.value)} required autoComplete="new-password" />
                </label>
              </div>
              <FormError msg={pwErr} />
              <FormOk msg={pwOk} />
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                  {pwBusy ? <span className="btn-spinner" /> : null} Change password
                </button>
              </div>
            </form>
          </section>

          {/* two-factor */}
          <section className="card">
            <div className="mb-[16px] flex items-center gap-[10px]">
              <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-green-400"><IconShield size={16} /></span>
              <div>
                <h3 className="text-[15px] font-bold">Authenticator app (2FA)</h3>
                <p className="text-[11.5px] text-text-3">Time-based codes — Google Authenticator, Authy, 1Password…</p>
              </div>
            </div>
            {user?.totpEnabled ? (
              <form onSubmit={disable2fa} className="flex flex-col gap-[12px]">
                <div className="flex items-center gap-[8px] rounded-lg border border-green/30 bg-[rgba(52,211,153,0.08)] px-[13px] py-[10px] text-[12.5px] text-green-400">
                  <IconCheck size={15} className="flex-none" /> 2FA is active on your account.
                </div>
                <label className="flex flex-col gap-[7px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Confirm password to disable</span>
                  <input className={FIELD} type="password" value={totpDisablePass} onChange={(e) => setTotpDisablePass(e.target.value)} required autoComplete="current-password" />
                </label>
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-sm !border-red-500/40 !text-red-400 hover:!bg-[rgba(248,113,113,0.1)]" disabled={totpBusy}>
                    {totpBusy ? <span className="btn-spinner" /> : null} Disable 2FA
                  </button>
                </div>
              </form>
            ) : totpSetup ? (
              <form onSubmit={confirm2fa} className="flex flex-col gap-[12px]">
                <div className="flex flex-wrap items-center gap-[16px]">
                  <img src={totpSetup.qr} alt="2FA QR code" className="h-[120px] w-[120px] flex-none rounded-lg border border-border bg-[#0d1424] p-[6px]" />
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[12.5px] text-text-2">Scan with your authenticator app, or enter this secret manually:</p>
                    <p className="mono mt-[6px] break-all rounded-lg border border-border bg-[rgba(0,0,0,0.3)] px-[10px] py-[6px] text-[12px] text-white">{totpSetup.secret}</p>
                  </div>
                </div>
                <label className="flex flex-col gap-[7px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Enter the 6-digit code to confirm</span>
                  <input
                    className={FIELD + " text-center tracking-[0.35em]"}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="123456"
                  />
                </label>
                <div className="flex justify-between">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTotpSetup(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={totpBusy}>
                    {totpBusy ? <span className="btn-spinner" /> : null} Enable 2FA
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-[10px]">
                <p className="text-[12.5px] text-text-2">Add a second step at sign-in. Even if your password leaks, your account stays safe.</p>
                <div className="flex justify-end">
                  <button className="btn btn-primary btn-sm" onClick={() => void start2fa()} disabled={totpBusy}>
                    {totpBusy ? <span className="btn-spinner" /> : null} Enable 2FA
                  </button>
                </div>
              </div>
            )}
            {totpMsg && <FormOk msg={totpMsg} />}
            <div className="mt-[10px]"><FormError msg={totpErr} /></div>
          </section>

          {/* passkeys */}
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
                <button className="btn btn-primary btn-sm" onClick={() => void addPasskey()} disabled={pkBusy}>
                  {pkBusy ? <span className="btn-spinner" /> : null} Add a passkey
                </button>
              </div>
            </div>
          </section>
        </div>
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
