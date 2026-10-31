import React, { useEffect, useMemo, useState } from "react";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { ServerSummary } from "../auth/AuthContext";
import { ServerCard } from "../components/ServerCard";
import { IconSearch, IconServer, IconActivity, IconClose, IconShield } from "../components/Icons";

type Filter = "all" | "online" | "offline";

export function ServersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [servers, setServers] = useState<ServerSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    setServers(null);
    (async () => {
      try {
        // Admin override: "all" fetches the whole fleet; everyone else always gets their own.
        const data = await api<{ servers: ServerSummary[] }>(`/api/servers${scope === "all" ? "?scope=all" : "?scope=mine"}`);
        if (!cancelled) setServers(data.servers);
      } catch (e) {
        if (!cancelled) setErr(e instanceof ApiError ? e.message : "Failed to load servers");
      }
    })();
    return () => { cancelled = true; };
  }, [scope]);

  const filtered = useMemo(() => {
    const list = servers ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((s) => {
      const isOnline = ["running", "started", "online"].includes((s.status ?? "").toLowerCase());
      if (filter === "online" && !isOnline) return false;
      if (filter === "offline" && isOnline) return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.image.toLowerCase().includes(needle) ||
        (s.node?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [servers, q, filter]);

  if (err) {
    return (
      <div className="container">
        <div className="card p-6 text-center">{err}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="page-head row-head flex items-flex-end justify-between gap-[20px] flex-wrap mb-[22px]">
        <div>
          <h1 className="page-title text-[clamp(26px,3vw,34px)] font-black brand-grad grad-text">Servers</h1>
          <p className="mt-[6px] text-[13.5px] text-text-2">
            {isAdmin && scope === "all" ? "Admin override — every server on the panel" : servers && servers.length === 1 ? "The game server assigned to your account" : "Game servers assigned to your account"}
          </p>
        </div>
        <div className="server-tools flex items-center gap-[10px] flex-wrap">
          {isAdmin && (
            <div className="filter-group flex gap-[4px] px-3 py-[3px] rounded-[11px] bg-white/3 border border-border" role="group" aria-label="Admin override scope">
              <FilterChip active={scope === "mine"} onClick={() => setScope("mine")}>My servers</FilterChip>
              <FilterChip icon={<IconShield size={14} className="flex-none" />} active={scope === "all"} onClick={() => setScope("all")}>Admin override</FilterChip>
            </div>
          )}
          <div className="search-box relative">
            <IconSearch size={16} className="absolute left-[11px] text-text-3 pointer-events-none" />
            <input className="w-[260px] h-9 pl-[34px] pr-[34px] rounded-lg bg-white/5 border border-border text-[12.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, image or node" aria-label="Filter servers" />
            {q && (
              <button className="search-clear absolute right-[8px] w-[20px] h-[20px] grid place-items-center rounded-[6px] text-text-3 hover:text-white hover:bg-white/8 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" onClick={() => setQ("")} aria-label="Clear filter">
                <IconClose size={14} />
              </button>
            )}
          </div>
          <div className="filter-group flex gap-[4px] px-3 py-[3px] rounded-[11px] bg-white/3 border border-border" role="group" aria-label="Status filter">
            <FilterChip icon={<IconServer size={15} className="flex-none" />} active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
            <FilterChip icon={<IconActivity size={15} className="flex-none" />} active={filter === "online"} onClick={() => setFilter("online")}>Online</FilterChip>
            <FilterChip active={filter === "offline"} onClick={() => setFilter("offline")}>Offline</FilterChip>
          </div>
        </div>
      </header>

      {servers === null ? (
        <div className="page-loading flex flex-col items-center justify-center gap-[14px] min-h-[46vh] text-text-3 text-[13px]"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card empty-card flex flex-col items-center text-center gap-[10px] p-[52px] p-[24px]">
          <span className="empty-art relative w-[84px] h-[84px] grid place-items-center rounded-[24px] bg-brand/7 border border-brand/22 mb-[6px]">
            <IconServer size={32} className="text-brand" />
            <span className="absolute inset-[-9px] rounded-[30px] border border-dashed border-cyan-400/35 drop-shadow-[0_0_6px_rgba(34,211,238,0.35)] animate-[spin_18s_linear_infinite]" />
          </span>
          <h3 className="text-[19px] font-bold">{servers.length === 0 ? "No servers yet" : "Nothing matches"}</h3>
          <p className="max-w-[460px] text-text-2 text-[13.5px]">{servers.length === 0 ? "No game servers have been assigned to your account yet." : "Try a different search term or switch the status filter."}</p>
        </div>
      ) : (
        <div className="server-grid grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[18px]">
          {filtered.map((s) => <ServerCard server={s} key={s.id} />)}
        </div>
      )}
    </div>
  );
}

function FilterChip({ icon, active, onClick, children }: { icon?: React.ReactNode; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`flex items-center gap-[6px] h-[28px] px-[11px] rounded-[8px] text-[12px] font-semibold transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${active ? "text-[#04121c] brand-grad shadow-[0_4px_14px_-6px_rgba(34,211,238,0.35)]" : "text-text-3 hover:text-white"}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
