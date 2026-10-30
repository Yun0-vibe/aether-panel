import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { IconUsers, IconMail, IconShield, IconSparkle } from "../components/Icons";

export function ProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.email?.split("@")[0] ?? "User");
  const [bio, setBio] = useState("Game server operator and panel administrator.");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="container max-w-[720px] mx-auto">
      <div className="page-head mb-[22px]">
        <h1 className="page-title text-[clamp(26px,3vw,34px)] font-black brand-grad grad-text">Profile</h1>
        <p className="mt-[6px] text-[13.5px] text-text-2">Your account, identity and settings.</p>
      </div>

      <section className="card relative overflow-hidden flex items-center gap-[20px] p-[24px] mb-[20px]">
        <div className="relative">
          <span className="avatar w-[72px] h-[72px] text-[22px] rounded-[18px] shadow-[0_8px_28px_-8px_rgba(34,211,238,0.5)]">{(user?.email ?? "?").slice(0, 1).toUpperCase()}</span>
          <span className="absolute bottom-[6px] right-[6px] w-[14px] h-[14px] rounded-full bg-green-500 border-[2.5px] border-[#0d1424] shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-[pulse_2.2s_ease-in-out_infinite]" />
        </div>
        <div className="flex-1 min-w-[0]">
          <h2 className="text-[18px] font-bold text-white">{displayName}</h2>
          <p className="text-[13px] text-text-2 mt-[4px] truncate">{user?.email}</p>
          <span className="inline-flex items-center gap-[6px] mt-[10px] px-[10px] py-[4px] rounded-full text-[11px] font-black tracking-[0.1em] uppercase text-white bg-[rgba(34,211,238,0.08)] border border-brand/22 shadow-[0_0_12px_rgba(34,211,238,0.2)]">
            <IconShield size={14} />
            ADMIN
          </span>
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[16px] mb-[20px]">
        <ProfileTile icon={<IconMail size={20} className="flex-none" />} label="Email" value={user?.email ?? "—"} />
        <ProfileTile icon={<IconShield size={20} className="flex-none" />} label="Role" value={user?.role ?? "user"} />
        <ProfileTile icon={<IconSparkle size={20} className="flex-none" />} label="Member since" value={new Date().toLocaleDateString()} />
      </div>

      <section className="card relative overflow-hidden mb-[20px]">
        <div className="flex items-center justify-between mb-[20px]">
          <h3 className="text-[15px] font-bold tracking-[0.02em]">About</h3>
          <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={saved}><IconSparkle size={15} className="flex-none" /> Save</button>
        </div>
        <textarea
          className="w-full min-h-[100px] p-[14px] rounded-[14px] bg-[#0a0e15] border border-border text-white text-[13.5px] leading-[1.65] outline-none focus:border-brand/60 focus-visible:ring-3 focus-visible:ring-brand/12 resize-y transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] font-ui"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Write something about yourself..."
        />
      </section>
    </div>
  );
}

function ProfileTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="glass-2 p-[20px] rounded-[18px] border border-border/8 bg-[rgba(19,27,47,0.78)] backdrop-blur-[16px] -webkit-backdrop-blur-[16px] hover:border-brand/50 hover:-translate-y-[2px] hover:shadow-[0_16px_36px_-16px_rgba(0,0,0,0.6)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
      <span className="stat-icon flex-none w-[40px] h-[40px] grid place-items-center rounded-[12px] bg-white/4 border border-white/8 text-text-2 mb-[12px]">{icon}</span>
      <div className="text-[10px] font-black tracking-[0.1em] uppercase text-text-3 mb-[4px]">{label}</div>
      <div className="font-display text-[16px] font-bold text-white truncate">{value}</div>
    </article>
  );
}
