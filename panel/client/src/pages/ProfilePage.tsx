import React, { useState } from "react";
import { useAuth, api, ApiError } from "../auth/AuthContext";
import {
  IconMail, IconShield, IconKey, IconDiscord, IconCheck, IconUsers, IconLock,
} from "../components/Icons";
import { RoleBadge } from "../components/RoleBadge";

const FIELD =
  "h-[40px] w-full rounded-lg border border-border bg-[rgba(0,0,0,0.26)] px-[13px] text-[13.5px] text-white outline-none transition-all duration-150 focus:border-brand/60 focus:bg-[rgba(34,211,238,0.05)]";
const PREFIX_FIELD =
  "h-[40px] w-full rounded-r-none rounded-lg rounded-l-none border border-border border-l-0 bg-[rgba(0,0,0,0.26)] px-[13px] text-[13.5px] text-white outline-none transition-all duration-150 focus:border-brand/60";

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

export function ProfilePage() {
  const { user, setUser } = useAuth();

  /* -------- profile form -------- */
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [discordId, setDiscordId] = useState(user?.discordId ?? "");
  const [proBusy, setProBusy] = useState(false);
  const [proErr, setProErr] = useState<string | null>(null);
  const [proOk, setProOk] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProErr(null); setProOk(null); setProBusy(true);
    try {
      const d = await api<{ user: NonNullable<typeof user> }>("/api/account", {
        method: "PATCH",
        body: { displayName, bio, discordId },
      });
      setUser(d.user);
      setProOk("Profile saved");
    } catch (e) {
      setProErr(e instanceof ApiError ? e.message : "Failed to save profile");
    } finally { setProBusy(false); }
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
                <IconDiscord size={13} className="flex-none" /> Discord linked
              </span>
            ) : (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-border bg-white/4 px-[10px] py-[3px]">
                <IconDiscord size={13} className="flex-none text-text-3" /> Discord not linked
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-[20px] xl:grid-cols-2">
        {/* profile edit */}
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
            <div className="flex flex-col gap-[7px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Discord</span>
              <div className="flex">
                <span className="flex h-[40px] flex-none items-center rounded-lg rounded-r-none border border-r-0 border-border bg-white/5 px-[12px] text-[12.5px] text-text-3"><IconDiscord size={15} /></span>
                <input className={PREFIX_FIELD} value={discordId ?? ""} onChange={(e) => setDiscordId(e.target.value)} placeholder="Discord ID (17-20 digits)" />
              </div>
              <p className="text-[11px] text-text-3">Paste your Discord user ID to link your account. Leave empty to unlink. Enable Developer Mode in Discord &rarr; Settings to copy it.</p>
            </div>
            <FormError msg={proErr} />
            <FormOk msg={proOk} />
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={proBusy}>
                {proBusy ? <span className="btn-spinner" /> : null} Save profile
              </button>
            </div>
          </form>
        </section>

        <div className="flex flex-col gap-[20px]">
          {/* security */}
          <section className="card">
            <div className="mb-[18px] flex items-center gap-[10px]">
              <span className="stat-icon flex h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-white/8 bg-white/4 text-brand"><IconKey size={16} /></span>
              <div>
                <h3 className="text-[15px] font-bold">Security</h3>
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

          {/* account info */}
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
