import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, gameAddress } from "../auth/AuthContext";
import type { ServerSummary } from "../auth/AuthContext";
import { StatusBadge } from "../components/ServerCard";
import { useToast } from "../components/Toasts";
import { FilesTab } from "./ServerFiles";
import { BackupsTab } from "./ServerBackups";
import { IconChevronLeft, IconPower, IconRefresh, IconSkull, IconStop, IconTerminal, IconClock, IconGlobe, IconServer, IconActivity, IconCpu, IconMemory, IconCopy, IconCheck } from "../components/Icons";

type Action = "start" | "stop" | "restart" | "kill";
const TABS = ["Console", "Files", "Backups"] as const;
type ServerTab = (typeof TABS)[number];

interface ConsoleLine { kind: "out" | "status"; text: string; }

interface StatsSnap {
  running: boolean;
  cpuPercent: number;
  memUsedMB: number;
  memLimitMB: number;
  pids: number;
}

/** Polls the daemon relay for one server's live resource usage. */
function LiveStats({ id, runningStatus }: { id: string; runningStatus: boolean }) {
  const [stats, setStats] = useState<StatsSnap | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    async function poll() {
      try {
        const d = await api<{ stats?: StatsSnap }>(`/api/servers/${encodeURIComponent(id)}/stats`);
        if (dead) return;
        const s = d.stats ?? null;
        setStats(s);
        setFailed(false);
        if (s && s.running) {
          setHistory((h) => {
            const next = [...h, s.cpuPercent];
            return next.length > 40 ? next.slice(-40) : next;
          });
        }
      } catch {
        if (!dead) setFailed(true);
      }
    }
    void poll();
    const t = window.setInterval(poll, 5000);
    return () => { dead = true; window.clearInterval(t); };
  }, [id]);

  if (failed) return null; // offline node: hide silently, status badge already shows it

  const cpu = stats?.cpuPercent ?? 0;
  const memU = stats?.memUsedMB ?? 0;
  const memL = Math.max(stats?.memLimitMB ?? 0, 1);
  const memPct = Math.min(100, (memU / memL) * 100);

  // Sparkline path (0-100 scaled, right-aligned).
  const W = 240, H = 42;
  const pts = history.length > 1
    ? history.map((v, i) => `${(i / (history.length - 1)) * W},${H - Math.min(100, v) / 100 * (H - 4) - 2}`).join(" ")
    : null;

  return (
    <section className="card p-[16px] flex flex-col gap-[13px]">
      <h3 className="flex items-center gap-[8px] text-[13px] font-bold tracking-[0.04em] uppercase text-text-2">
        <IconActivity size={15} className="flex-none text-brand" /> Live usage
        <span className={`ml-auto inline-flex items-center gap-[6px] text-[10.5px] font-bold normal-case tracking-normal ${runningStatus ? "text-green-400" : "text-text-3"}`}>
          <span className={`w-[6px] h-[6px] rounded-full ${runningStatus ? "bg-green-500 animate-pulse" : "bg-slate-500"}`} />
          {runningStatus ? "live" : "stopped"}
        </span>
      </h3>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="inline-flex items-center gap-[6px] text-[11px] font-bold uppercase tracking-wider text-text-3"><IconCpu size={13} className="flex-none" /> CPU</span>
          <span className="font-mono text-[16px] font-bold text-white">{cpu.toFixed(1)}<span className="text-[11px] text-text-3">%</span></span>
        </div>
        {pts && (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-[6px] overflow-visible" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
            <polyline points={`0,${H} ${pts} ${W},${H}`} fill="rgba(34,211,238,0.10)" stroke="none" />
          </svg>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="inline-flex items-center gap-[6px] text-[11px] font-bold uppercase tracking-wider text-text-3"><IconMemory size={13} className="flex-none" /> Memory</span>
          <span className="font-mono text-[13px] font-bold text-white">{memU.toFixed(0)}<span className="text-[11px] text-text-3"> / {memL.toFixed(0)} MB</span></span>
        </div>
        <div className="mt-[7px] h-[6px] w-full overflow-hidden rounded-full bg-white/6">
          <div
            className="h-full rounded-full transition-all duration-500 brand-grad"
            style={{ width: `${runningStatus ? memPct : 0}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-[11px] text-[11.5px] text-text-3">
        <span>Processes</span>
        <span className="font-mono text-white">{stats?.pids ?? 0}</span>
      </div>
    </section>
  );
}

/** host:port chip with one-click copy-to-clipboard. */
function CopyAddress({ address, label }: { address: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.push(`Copied ${label} — ${address}`, "success");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.pushError("Clipboard blocked by the browser");
    }
  }

  return (
    <button
      onClick={copy}
      className="group inline-flex items-center gap-[7px] px-[10px] py-[7px] rounded-lg bg-white/4 border border-border font-mono text-[11.5px] text-text-2 transition-all duration-150 hover:border-brand/60 hover:text-brand"
      title={`Click to copy ${address}`}
      aria-label={`Copy server address ${address}`}
    >
      <IconGlobe size={14} className="flex-none text-text-3 group-hover:text-brand" />
      <span className="trunc max-w-[220px]">{address}</span>
      {copied ? <IconCheck size={13} className="flex-none text-green-400" /> : <IconCopy size={13} className="flex-none text-text-3 group-hover:text-brand" />}
    </button>
  );
}

function buildWsUrl(id: string) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/servers/${encodeURIComponent(id)}/console`;
}

export function ServerDetail() {
  const { id = "" } = useParams();
  const [server, setServer] = useState<(ServerSummary & { ports?: Array<{ port: number; protocol: string }> }) | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [tab, setTab] = useState<ServerTab>("Console");

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ server?: ServerSummary } & Partial<ServerSummary>>(`/api/servers/${encodeURIComponent(id)}`);
      const s = ("server" in data && data.server ? data.server : (data as ServerSummary));
      setServer(s);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : "Failed to load server");
    }
  }, [id]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    let dead = false;
    let ws: WebSocket | null = null;
    let retryTimer: number | undefined;
    function connect() {
      if (dead) return;
      ws = new WebSocket(buildWsUrl(id));
      wsRef.current = ws;
      ws.onopen = () => { if (!dead) setConnected(true); };
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data as string) as { t?: string; d?: string };
          if (frame.t === "out" && typeof frame.d === "string") {
            const text = frame.d;
            setLines((prev: ConsoleLine[]) => {
              const next: ConsoleLine[] = [...prev, { kind: "out", text }];
              return next.length > 2000 ? next.slice(-2000) : next;
            });
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { if (dead) return; setConnected(false); retryTimer = window.setTimeout(connect, 1500); };
      ws.onerror = () => ws?.close();
    }
    connect();
    return () => { dead = true; if (retryTimer) window.clearTimeout(retryTimer); ws?.close(); wsRef.current = null; };
  }, [id]);

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]);

  async function power(action: Action) {
    setBusy(action);
    try {
      await api(`/api/servers/${encodeURIComponent(id)}/power`, { method: "POST", body: { action } });
      toast.push(`Sent "${action}" to server`, "success");
      void refresh();
    } catch (e) {
      toast.pushError(e instanceof ApiError ? e.message : "Power action failed");
    } finally { setBusy(null); }
  }

  function sendCommand(e?: React.FormEvent) {
    e?.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ t: "in", d: cmd }));
      setHistory((h) => [...h, cmd]);
      setHistIdx(-1);
      setInput("");
    } else { toast.push("Console not connected", "error"); }
    inputRef.current?.focus();
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length === 0) return;
      let idx = histIdx;
      idx = e.key === "ArrowUp" ? (histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1)) : (histIdx < 0 ? -1 : histIdx + 1 >= history.length ? -1 : histIdx + 1);
      setHistIdx(idx);
      setInput(idx >= 0 ? history[idx] : "");
    }
  }

  function escapeHtml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  if (loadErr) {
    return (<div className="container"><div className="card p-6">{loadErr} — <Link to="/servers">back to servers</Link></div></div>);
  }
  if (!server) {
    return (<div className="container page-loading flex flex-col items-center justify-center gap-[14px] min-h-[46vh] text-text-3 text-[13px]"><div className="spinner" /></div>);
  }

  const status = server.status ?? "";
  const running = ["running", "started", "online"].includes(status.toLowerCase());

  return (
    <div className="container server-detail">
      <div className="breadcrumbs flex items-center gap-[8px] mb-[14px] text-[12.5px] text-text-3">
        <Link to="/servers" className="crumb-link inline-flex items-center gap-[4px] font-semibold text-text-2 hover:text-brand transition-colors duration-150">
          <IconChevronLeft size={14} className="flex-none" />
          Servers
        </Link>
        <span className="crumb-sep">/</span>
        <span className="crumb-current text-[12.5px] font-semibold text-white">{server.name}</span>
      </div>

      <div className="card detail-head flex items-center justify-between gap-[18px] flex-wrap mb-[18px]">
        <div className="detail-head-left min-w-0 flex flex-col gap-[9px]">
          <h1 className="page-title text-[clamp(26px,3vw,34px)] font-black brand-grad grad-text">{server.name}</h1>
          <div className="detail-meta flex items-center gap-[8px] flex-wrap">
            <span className="detail-chip inline-flex items-center gap-[6px] px-[4px] py-[10px] rounded-lg bg-white/4 border border-border text-[11.5px] font-semibold text-text-2"><IconServer size={14} className="flex-none text-text-3" /><span className="trunc max-w-[260px]" title={server.image}>{server.image}</span></span>
            <span className="detail-chip inline-flex items-center gap-[6px] px-[4px] py-[10px] rounded-lg bg-white/4 border border-border text-[11.5px] font-semibold text-text-2"><IconActivity size={14} className="flex-none text-text-3" /><span>Node: {server.node?.name ?? server.nodeId}</span></span>
            {(() => {
              const primary = server.port ?? server.ports?.find((p) => p.protocol === "tcp")?.port ?? null;
              const addr = gameAddress(server.node?.host, primary);
              return addr ? <CopyAddress address={addr} label="server address" /> : null;
            })()}
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="power-buttons flex gap-[8px] flex-wrap">
          <PowerBtn label="Start" action="start" busy={busy} onClick={power} tone="green" icon={<IconPower size={16} className="flex-none" />} />
          <PowerBtn label="Restart" action="restart" busy={busy} onClick={power} tone="blue" icon={<IconRefresh size={16} className="flex-none" />} />
          <PowerBtn label="Stop" action="stop" busy={busy} onClick={power} tone="amber" icon={<IconStop size={16} className="flex-none" />} />
          <PowerBtn label="Kill" action="kill" busy={busy} onClick={power} tone="red" icon={<IconSkull size={16} className="flex-none" />} />
        </div>
      </div>

      <div className="tab-nav flex gap-[4px] mb-[18px] border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab relative h-[40px] px-[15px] border-r rounded-[10px]_rounded-[10px]_0_0 text-[13px] font-bold whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${tab === t ? "text-brand" : "text-text-3"} hover:text-white hover:bg-white/4`} onClick={() => setTab(t)}>
            {t === "Console" && <IconTerminal size={16} className="flex-none opacity-80" />}
            {t === "Files" && <IconServer size={16} className="flex-none opacity-80" />}
            {t === "Backups" && <IconClock size={16} className="flex-none opacity-80" />}
            {t}
          </button>
        ))}
      </div>

      {tab === "Console" && (
        <div className="detail-grid grid grid-cols-[minmax(0,1fr)_300px] gap-[16px] align-start">
          <section className="card console-card p-[16px]">
            <div className="console-head flex items-center justify-between gap-[10px] mb-[12px] pb-[11px] border-b border-border">
              <span className="console-title flex items-center gap-[8px] font-display text-[13px] font-bold tracking-[0.04em] uppercase">Console</span>
              <span className={`conn-dot flex items-center gap-[7px] text-[11.5px] font-bold ${connected ? "text-green-400" : "text-text-3"}`}>
                {connected ? "connected" : "connecting…"}
                {connected && <span className="w-[7px] h-[7px] rounded-full bg-green-400 shadow-[0_0_9px_rgba(52,211,153,0.5)] animate-pulse" />}
              </span>
            </div>
            <div className="console h-[340px] overflow-y-auto p-[14px] rounded-lg bg-[#04060c] border border-border font-mono text-[12px] leading-[1.7] text-slate-300" ref={scrollRef}>
              {lines.length === 0 && <div className="console-empty text-text-3 italic text-center pt-[40px]">// waiting for output…</div>}
              {lines.map((l, i) => (<div key={i} className="console-line mb-[2px] whitespace-pre-wrap break-words dangerously-set-inner-html">{escapeHtml(l.text).replace(/\n/g, "<br/>")}</div>))}
            </div>
            <form className="console-input-row flex items-center gap-[9px] mt-[12px]" onSubmit={sendCommand}>
              <span className="console-prompt font-mono font-bold text-brand">$</span>
              <input ref={inputRef} className="console-input flex-1 min-w-[0] h-[36px] px-[12px] rounded-lg bg-[#000]/3 border border-border font-mono text-[12.5px] outline-none focus:border-brand/60 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onInputKey} placeholder="Type a command and press Enter…" spellCheck={false} autoComplete="off" />
              <button className="btn btn-primary" type="submit" disabled={!connected}>Send</button>
            </form>
          </section>

          <aside className="flex flex-col gap-[16px]">
            <LiveStats id={id} runningStatus={running} />
            <section className="card info-card flex flex-col gap-[14px] p-[16px]">
              <h3 className="text-[14px] font-bold tracking-[0.04em] uppercase text-text-2">Server info</h3>
              <dl className="info-list flex flex-col gap-[13px] m-0">
                <div className="flex flex-col gap-[4px]"><dt className="text-[10px] font-black tracking-widest uppercase text-text-3">Image</dt><dd className="mono text-[13px] text-white">{server.image}</dd></div>
                <div className="flex flex-col gap-[4px]"><dt className="text-[10px] font-black tracking-widest uppercase text-text-3">Ports</dt><dd className="flex flex-wrap gap-[4px]">{(server.ports ?? []).map((p) => (<span key={`${p.port}-${p.protocol}`} className="rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px] text-[10.5px] font-bold text-text-2">{p.port}/{p.protocol}</span>))}{!(server.ports ?? []).length && <span className="text-white">{server.port ?? "—"}</span>}</dd></div>
                <div className="flex flex-col gap-[4px]"><dt className="text-[10px] font-black tracking-widest uppercase text-text-3">Node</dt><dd className="text-[13px] text-white">{server.node?.name ?? server.nodeId}{server.node?.host && <span className="muted text-text-3"> ({server.node.host})</span>}</dd></div>
                <div className="flex flex-col gap-[4px]"><dt className="text-[10px] font-black tracking-widest uppercase text-text-3">Status</dt><dd className="flex items-center gap-[2px]"><StatusBadge status={status} /></dd></div>
              </dl>
              <div className="cpu-note mt-[12px] border-t border-border pt-[12px] text-[11.5px] text-text-3 leading-[1.6]">CPU/memory limits (cpus, memoryMB) are configured by admins when the server is created.</div>
            </section>
          </aside>
        </div>
      )}

      {tab === "Files" && <FilesTab serverId={id} />}
      {tab === "Backups" && <BackupsTab serverId={id} />}
    </div>
  );
}

function PowerBtn({ label, action, busy, onClick, tone, icon }: { label: string; action: Action; busy: Action | null; onClick: (a: Action) => void; tone: "green" | "blue" | "amber" | "red"; icon: React.ReactNode }) {
  const active = busy === action;
  const tones: Record<string, string> = { green: "btn-green", blue: "btn-blue", amber: "btn-amber", red: "btn-red" };
  return (
    <button className={`btn ${tones[tone]}`} disabled={busy !== null} onClick={() => onClick(action)}>
      {active ? <span className="btn-spinner" /> : icon}
      {active ? `${label}…` : label}
    </button>
  );
}
