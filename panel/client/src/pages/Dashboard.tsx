import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { ServerSummary } from "../auth/AuthContext";

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "running" || s === "started" || s === "online"
      ? "badge-green"
      : s === "stopped" || s === "exited" || s === "" || s === "offline"
        ? "badge-gray"
        : s === "starting" || s === "restarting"
          ? "badge-blue"
          : s === "killed" || s === "error"
            ? "badge-red"
            : "badge-yellow";
  return <span className={`status-badge ${cls}`}>{s || "unknown"}</span>;
}

export { StatusBadge };

export function Dashboard() {
  const { user } = useAuth();
  const [servers, setServers] = useState<ServerSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ servers: ServerSummary[] }>("/api/servers");
        if (!cancelled) setServers(data.servers);
      } catch (e) {
        if (!cancelled) setErr(e instanceof ApiError ? e.message : "Failed to load servers");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function imageLabel(image: string) {
    return image.replace(/^.*\//, "");
  }

  if (err) {
    return (
      <div className="container">
        <div className="card error-card">{err}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Your servers</h1>
          <p className="page-sub">Welcome{user ? `, ${user.email}` : ""} — {servers?.length ?? "…"} server(s)</p>
        </div>
      </div>

      {!servers ? (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      ) : servers.length === 0 ? (
        <div className="card empty-card">
          <h3>No servers yet</h3>
          <p>An admin hasn't assigned any servers to your account.</p>
        </div>
      ) : (
        <div className="server-grid">
          {servers.map((s) => (
            <Link to={`/servers/${s.id}`} key={s.id} className="card server-card" data-status={(s.status ?? "").toLowerCase()}>
              <div className="server-card-head">
                <h3>{s.name}</h3>
                <StatusBadge status={s.status} />
              </div>
              <div className="server-card-meta">
                <span title={s.image}>{imageLabel(s.image)}</span>
                <span>Node: {s.node?.name ?? s.nodeId}</span>
                {s.port != null && <span>Port: {s.port}</span>}
              </div>
              <div className="server-card-img" title={s.image}>
                {s.image}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
