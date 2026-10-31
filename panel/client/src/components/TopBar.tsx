import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { IconBell, IconSearch, IconSparkle, AetherMark } from "./Icons";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "Dashboard", sub: "Overview of your fleet" },
  "/servers": { title: "Servers", sub: "Every game server you own" },
  "/admin": { title: "Administration", sub: "Users, nodes and server assignments" },
};

export function TopBar({ onToggleNav, navOpen }: { onToggleNav: () => void; navOpen: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const meta = TITLES[location.pathname] ?? {
    title: location.pathname.startsWith("/servers/") ? "Server" : "Aether",
    sub: location.pathname.startsWith("/servers/") ? "Live control" : "",
  };

  return (
    <header className="sticky top-0 z-50 h-[64px] flex items-center gap-5 px-[30px] border-b border-border bg-[rgba(7,10,19,0.72)] backdrop-blur-[20px] -webkit-backdrop-blur-[20px]">
      <button className="flex flex-col justify-center gap-[4px] w-7 h-7 px-2 rounded-lg border border-white/4 bg-white/4 flex-none hover:border-brand/60 hover:text-brand transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden" onClick={onToggleNav} aria-label="Toggle navigation" aria-expanded={navOpen}>
        <span className="w-[22px] h-[1px] rounded-full bg-text-2 transition-all duration-150" />
        <span className="w-[22px] h-[1px] rounded-full bg-text-2 transition-all duration-150" />
        <span className="w-[22px] h-[1px] rounded-full bg-text-2 transition-all duration-150" />
      </button>
      <div className="flex items-center gap-2.5 min-w-0">
        <AetherMark size={30} className="filter-drop-shadow-[0_0_10px_rgba(34,211,238,0.4)] z-10" />
        <div className="flex flex-col leading-[1.2] min-w-0">
          <span className="text-[14px] font-bold">{meta.title}</span>
          <span className="mt-[1px] text-[11px] trunc text-text-3">{meta.sub}</span>
        </div>
      </div>

      <div className="relative flex-1 max-w-[420px] flex items-center">
        <input className="w-full h-9 pl-10 pr-[54px] rounded-lg bg-white/5 border border-border text-white text-[13px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search servers, nodes, users…" aria-label="Search" />
        <IconSearch size={16} className="absolute left-[11px] text-text-3 pointer-events-none" />
        <kbd className="absolute right-[10px] py-[2px] px-[6px] rounded-[5px] text-[10px] text-text-3 bg-white/5 border border-border pointer-events-none font-mono">⌘K</kbd>
      </div>

      <div className="flex items-center gap-[10px] ml-auto">
        <span className="hidden md:flex font-mono text-[12px] text-text-3 tracking-[0.04em] pr-[4px]">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span className="hidden md:flex flex items-center gap-[7px] h-[30px] px-3 rounded-full border border-green/24 bg-green/10 text-[11.5px] font-semibold text-green-400 flex items-center gap-[7px]">
          <span className="w-[6px] h-[6px] rounded-full bg-green-500 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-[pulse_2.2s_ease-in-out_infinite]" />
          Operational
        </span>
        <button className="flex-none w-7 h-7 grid place-items-center rounded-[9px] border border-transparent text-text-2 hover:text-brand hover:bg-brand/10 hover:border-brand/60 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" title="What's new" aria-label="What's new">
          <IconSparkle size={17} />
        </button>
        <button className="relative flex-none w-7 h-7 grid place-items-center rounded-[9px] border border-transparent text-text-2 hover:text-brand hover:bg-brand/10 hover:border-brand/60 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" title="Notifications" aria-label="Notifications">
          <IconBell size={17} />
          <span className="absolute top-[5px] right-[5px] w-[6px] h-[6px] rounded-full bg-red-500 shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
        </button>
        <span className="flex-none w-7 h-7 grid place-items-center rounded-[9px] text-[11px] font-bold text-[#04121c] brand-grad">
          {(user?.email ?? "?").slice(0, 2).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
