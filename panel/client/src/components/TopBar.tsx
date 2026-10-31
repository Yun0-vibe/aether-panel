import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, api } from "../auth/AuthContext";
import type { ServerSummary } from "../auth/AuthContext";
import {
  IconBell, IconSearch, AetherMark, IconGrid, IconServer,
  IconUsers, IconLayers, IconShield, IconCheck, IconAlert,
} from "./Icons";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "Dashboard", sub: "Overview of your fleet" },
  "/servers": { title: "Servers", sub: "Every game server you own" },
  "/profile": { title: "Account", sub: "Profile, security and integrations" },
};

/* ------------------------------------------------------------------ palette */

interface NavItem {
  id: string;
  label: string;
  sub: string;
  to: string;
  icon: React.ReactNode;
  keywords: string;
}

function Palette({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<ServerSummary[] | null>(null);
  const [adminExtra, setAdminExtra] = useState<Array<{ id: string; kind: "user" | "node"; label: string; sub: string }> | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load lookup data the first time the palette opens.
  useEffect(() => {
    if (!open || servers !== null) return;
    api<{ servers?: ServerSummary[] }>("/api/servers")
      .then((d) => setServers(d.servers ?? []))
      .catch(() => setServers([]));
    if (user?.role === "admin" && adminExtra === null) {
      Promise.all([
        api<{ users?: Array<{ id: string; email: string }> }>("/api/admin/users").catch(() => ({ users: [] })),
        api<{ nodes?: Array<{ id: string; name: string; host: string }> }>("/api/admin/nodes").catch(() => ({ nodes: [] })),
      ]).then(([u, n]) => {
        setAdminExtra([
          ...(u.users ?? []).map((x) => ({ id: x.id, kind: "user" as const, label: x.email, sub: "User" })),
          ...(n.nodes ?? []).map((x) => ({ id: x.id, kind: "node" as const, label: x.name, sub: x.host })),
        ]);
      });
    }
  }, [open, servers, user?.role, adminExtra]);

  const items = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      { id: "p-dash", label: "Dashboard", sub: "Page", to: "/", icon: <IconGrid size={16} />, keywords: "home overview" },
      { id: "p-srv", label: "Servers", sub: "Page", to: "/servers", icon: <IconServer size={16} />, keywords: "list fleet machines" },
      { id: "p-acc", label: "Account", sub: "Page", to: "/profile", icon: <IconShield size={16} />, keywords: "profile password discord settings" },
    ];
    const srv: NavItem[] = (servers ?? []).map((s) => ({
      id: `s-${s.id}`,
      label: s.name,
      sub: s.node?.name ?? "Server",
      to: `/servers/${s.id}`,
      icon: <IconServer size={16} />,
      keywords: s.status ?? "",
    }));
    const adm: NavItem[] = user?.role === "admin"
      ? [
          { id: "a-ov", label: "Admin overview", sub: "Admin portal", to: "/admin", icon: <IconShield size={16} />, keywords: "admin portal dashboard" },
          { id: "a-us", label: "Admin users", sub: "Admin portal", to: "/admin/users", icon: <IconUsers size={16} />, keywords: "users accounts roles" },
          { id: "a-no", label: "Admin nodes", sub: "Admin portal", to: "/admin/nodes", icon: <IconLayers size={16} />, keywords: "nodes daemons machines" },
          { id: "a-as", label: "Admin servers", sub: "Admin portal", to: "/admin/servers", icon: <IconServer size={16} />, keywords: "servers provision" },
        ]
      : [];
    const foundUsers: NavItem[] = (adminExtra ?? [])
      .filter((x) => x.kind === "user")
      .map((x) => ({
        id: `u-${x.id}`,
        label: x.label,
        sub: `User · ${x.id.slice(0, 8)}`,
        to: "/admin/users",
        icon: <IconUsers size={16} />,
        keywords: "user account",
      }));
    const foundNodes: NavItem[] = (adminExtra ?? [])
      .filter((x) => x.kind === "node")
      .map((x) => ({
        id: `n-${x.id}`,
        label: x.label,
        sub: x.sub,
        to: "/admin/nodes",
        icon: <IconLayers size={16} />,
        keywords: "node daemon machine",
      }));
    return [...base, ...srv, ...adm, ...foundNodes, ...foundUsers];
  }, [servers, adminExtra, user?.role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 9);
    return items
      .filter((i) => `${i.label} ${i.sub} ${i.keywords}`.toLowerCase().includes(q))
      .slice(0, 9);
  }, [items, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  function go(item: NavItem | undefined) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); go(filtered[active]); }
    if (e.key === "Escape") onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-[#03060e]/70 p-6 pt-[14vh] backdrop-blur-[8px] animate-[fade-in_180ms_var(--ease)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-[18px] border border-white/12 bg-gradient-to-b from-[rgba(18,25,43,0.98)] to-[rgba(12,17,31,0.98)] shadow-[0_40px_90px_-28px_rgba(0,0,0,0.95)] animate-[modal-in_240ms_var(--ease)]" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-[10px] border-b border-border px-4">
          <IconSearch size={16} className="flex-none text-text-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search servers, pages, users…"
            className="h-[52px] flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-text-3"
            aria-label="Command palette search"
          />
          <kbd className="rounded-[5px] border border-border bg-white/5 px-[6px] py-[2px] font-mono text-[10px] text-text-3">ESC</kbd>
        </div>
        <div className="max-h-[54vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-text-3">Nothing matches “{query}”</div>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.id}
              onClick={() => go(item)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-[12px] rounded-[11px] px-3 py-[10px] text-left transition-colors duration-100 ${i === active ? "bg-brand/12 text-white" : "text-text-2 hover:bg-white/4"}`}
            >
              <span className={`flex h-8 w-8 flex-none place-items-center rounded-[9px] border border-border bg-white/4 ${i === active ? "text-brand" : "text-text-3"}`}>{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-white">{item.label}</span>
                <span className="block truncate text-[11.5px] text-text-3">{item.sub}</span>
              </span>
              <span className="font-mono text-[10px] text-text-3">↵</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bell */

interface BellServer { id: string; name: string; status: string | null }

function Bell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<BellServer[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ servers?: BellServer[] }>("/api/servers");
      const bad = (d.servers ?? []).filter((s) => {
        const st = (s.status ?? "").toLowerCase();
        return ["stopped", "exited", "killed", "error", "node-offline", "offline"].includes(st);
      });
      setAlerts(bad);
    } catch {
      setAlerts(null);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
    const t = window.setInterval(load, 20_000);
    return () => window.clearInterval(t);
  }, [open, load]);

  // Dismiss on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const count = alerts?.length ?? 0;
  return (
    <div className="relative flex-none" ref={wrapRef}>
      <button
        className="relative w-7 h-7 grid place-items-center rounded-[9px] border border-transparent text-text-2 hover:text-brand hover:bg-brand/10 hover:border-brand/60 transition-all duration-150"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell size={17} />
        {count > 0 && (
          <span className="absolute top-[5px] right-[5px] grid h-[10px] w-[10px] place-items-center rounded-full bg-red-500 text-[7px] font-black text-white shadow-[0_0_6px_rgba(248,113,113,0.5)]">
            {count > 9 ? "9" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[38px] w-[300px] overflow-hidden rounded-[14px] border border-white/12 bg-gradient-to-b from-[rgba(18,25,43,0.98)] to-[rgba(12,17,31,0.98)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] animate-[modal-in_200ms_var(--ease)]">
          <div className="border-b border-border px-4 py-[11px] text-[12px] font-bold text-text-2">
            Live alerts
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {alerts === null && <div className="px-3 py-5 text-center text-[12.5px] text-text-3">Checking fleet…</div>}
            {alerts !== null && alerts.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-5 text-[12.5px] text-green-400">
                <IconCheck size={15} className="flex-none" /> All servers are online
              </div>
            )}
            {alerts?.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-[10px] px-3 py-[9px] hover:bg-white/4">
                <IconAlert size={15} className="flex-none text-yellow-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-white">{s.name}</span>
                  <span className="block text-[11px] text-text-3">{(s.status ?? "unknown").toLowerCase()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

export function TopBar({ onToggleNav, navOpen }: { onToggleNav: () => void; navOpen: boolean }) {
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // ⌘K / Ctrl+K opens the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const meta = TITLES[location.pathname] ?? {
    title: location.pathname.startsWith("/servers/") ? "Server" : location.pathname.startsWith("/admin") ? "Admin portal" : "Aether",
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

      {/* Search — a real command palette launcher */}
      <button
        className="group relative flex-1 max-w-[420px] flex items-center h-9 pl-10 pr-[54px] rounded-lg bg-white/5 border border-border text-left outline-none hover:border-brand/50 hover:bg-white/7 transition-all duration-150"
        onClick={() => setPaletteOpen(true)}
        aria-label="Open command palette"
      >
        <IconSearch size={16} className="absolute left-[11px] text-text-3 pointer-events-none" />
        <span className="text-[13px] text-text-3 group-hover:text-text-2 transition-colors">Search servers, nodes, users…</span>
        <kbd className="absolute right-[10px] py-[2px] px-[6px] rounded-[5px] text-[10px] text-text-3 bg-white/5 border border-border pointer-events-none font-mono">⌘K</kbd>
      </button>

      <div className="flex items-center gap-[10px] ml-auto">
        <span className="hidden md:flex font-mono text-[12px] text-text-3 tracking-[0.04em] pr-[4px]">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span className="hidden md:flex flex items-center gap-[7px] h-[30px] px-3 rounded-full border border-green/24 bg-green/10 text-[11.5px] font-semibold text-green-400">
          <span className="w-[6px] h-[6px] rounded-full bg-green-500 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-[pulse_2.2s_ease-in-out_infinite]" />
          Operational
        </span>
        <Bell />
        <button
          className="flex-none w-7 h-7 grid place-items-center rounded-[9px] border border-transparent text-text-2 hover:text-brand hover:bg-brand/10 hover:border-brand/60 transition-all duration-150"
          title={window.location.pathname.startsWith("/admin") ? "Back to client area" : "Admin portal"}
          aria-label={window.location.pathname.startsWith("/admin") ? "Back to client area" : "Admin portal"}
          onClick={() => { window.location.href = window.location.pathname.startsWith("/admin") ? "/" : "/admin"; }}
        >
          <IconShield size={17} />
        </button>
      </div>

      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
