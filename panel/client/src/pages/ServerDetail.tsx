import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../auth/AuthContext";
import type { ServerSummary } from "../auth/AuthContext";
import { StatusBadge } from "./Dashboard";
import { useToast } from "../components/Toasts";

type Action = "start" | "stop" | "restart" | "kill";

interface ConsoleLine {
  kind: "out" | "status";
  text: string;
}

function buildWsUrl(id: string) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/servers/${encodeURIComponent(id)}/console`;
}

function plainServerId(id: string) {
  // Backend may swap in ids with special chars; encodeURIComponent is already applied in URLs.
  return id;
}

export function ServerDetail() {
  const { id = "" } = useParams();
  const [server, setServer] = useState<ServerSummary | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Load server info + poll status while connected page is open.
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

  // Websocket console
  useEffect(() => {
    let dead = false;
    let ws: WebSocket | null = null;
    let retryTimer: number | undefined;

    function connect() {
      if (dead) return;
      ws = new WebSocket(buildWsUrl(plainServerId(id)));
      wsRef.current = ws;
      ws.onopen = () => {
        if (!dead) setConnected(true);
      };
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data as string) as { t?: string; d?: string };
          if (frame.t === "out" && typeof frame.d === "string") {
            setLines((l) => {
              const next = [...l, { kind: "out" as const, text: frame.d! }];
              return next.length > 2000 ? next.slice(next.length - 2000) : next;
            });
          }
        } catch {
          /* non-JSON frame; ignore */
        }
      };
      ws.onclose = () => {
        if (dead) return;
        setConnected(false);
        retryTimer = window.setTimeout(connect, 1500);
      };
      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      dead = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, [id]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function power(action: Action) {
    setBusy(action);
    try {
      await api(`/api/servers/${encodeURIComponent(id)}/power`, { method: "POST", body: { action } });
      toast.push(`Sent "${action}" to server`, "success");
      void refresh();
    } catch (e) {
      toast.pushError(e instanceof ApiError ? e.message : "Power action failed");
    } finally {
      setBusy(null);
    }
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
    } else {
      toast.push("Console not connected", "error");
    }
    inputRef.current?.focus();
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length === 0) return;
      let idx = histIdx;
      if (e.key === "ArrowUp") idx = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      else idx = histIdx < 0 ? -1 : histIdx + 1 >= history.length ? -1 : histIdx + 1;
      setHistIdx(idx);
      setInput(idx >= 0 ? history[idx] : "");
    }
  }

  if (loadErr) {
    return (
      <div className="container">
        <div className="card error-card">
          {loadErr} — <Link to="/">back to dashboard</Link>
        </div>
      </div>
    );
  }
  if (!server) {
    return (
      <div className="container page-loading">
        <div className="spinner" />
      </div>
    );
  }

  const status = server.status ?? "";

  return (
    <div className="container server-detail">
      <div className="breadcrumbs">
        <Link to="/">Dashboard</Link> <span>/</span> <span>{server.name}</span>
      </div>

      <div className="card detail-head">
        <div className="detail-head-left">
          <h1 className="page-title">{server.name}</h1>
          <div className="detail-meta">
            <span title={server.image}>{server.image}</span>
            <span className="dot">•</span>
            <span>Node: {server.node?.name ?? server.nodeId}</span>
            {server.port != null && (
              <>
                <span className="dot">•</span>
                <span>Port {server.port}</span>
              </>
            )}
            <span className="dot">•</span>
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="power-buttons">
          <PowerBtn label="Start" action="start" busy={busy} onClick={power} green />
          <PowerBtn label="Restart" action="restart" busy={busy} onClick={power} blue />
          <PowerBtn label="Stop" action="stop" busy={busy} onClick={power} />
          <PowerBtn label="Kill" action="kill" busy={busy} onClick={power} red />
        </div>
      </div>

      <div className="detail-grid">
        <section className="card console-card">
          <div className="console-head">
            <span className="console-title">Console</span>
            <span className={`conn-dot ${connected ? "on" : "off"}`}>
              {connected ? "connected" : "connecting…"}
            </span>
          </div>
          <div className="console" ref={scrollRef}>
            {lines.length === 0 && (
              <div className="console-empty">// waiting for output…</div>
            )}
            {lines.map((l, i) => (
              <div key={i} className="console-line">
                <span dangerouslySetInnerHTML={{ __html: escapeHtml(l.text).replace(/\n/g, "<br/>") }} />
              </div>
            ))}
          </div>
          <form className="console-input-row" onSubmit={sendCommand}>
            <span className="console-prompt">$</span>
            <input
              ref={inputRef}
              className="console-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Type a command and press Enter…"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="btn btn-primary" type="submit" disabled={!connected}>
              Send
            </button>
          </form>
        </section>

        <aside className="card info-card">
          <h3>Server info</h3>
          <dl className="info-list">
            <div>
              <dt>Image</dt>
              <dd className="mono">{server.image}</dd>
            </div>
            <div>
              <dt>Port</dt>
              <dd>{server.port ?? "—"}</dd>
            </div>
            <div>
              <dt>Node</dt>
              <dd>
                {server.node?.name ?? server.nodeId}
                {server.node?.host && <span className="muted"> ({server.node.host})</span>}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={status} />
              </dd>
            </div>
          </dl>
          <div className="cpu-note muted">
            CPU/memory limits (cpus, memoryMB) are configured by admins when the server is created.
          </div>
        </aside>
      </div>
    </div>
  );
}

function PowerBtn({
  label,
  action,
  busy,
  onClick,
  green,
  blue,
  red,
}: {
  label: string;
  action: Action;
  busy: Action | null;
  onClick: (a: Action) => void;
  green?: boolean;
  blue?: boolean;
  red?: boolean;
}) {
  const active = busy === action;
  return (
    <button
      className={`btn ${green ? "btn-green" : blue ? "btn-blue" : red ? "btn-red" : "btn-ghost"}`}
      disabled={busy !== null}
      onClick={() => onClick(action)}
    >
      {active ? <span className="btn-spinner" /> : null}
      {active ? `${label}…` : label}
    </button>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
