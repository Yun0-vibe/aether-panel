import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { ServerSummary, User } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";

/* ---------------- types ---------------- */

interface AdminUser extends User {
  createdAt?: string;
}
interface Node {
  id: string;
  name: string;
  host: string;
  daemonPort: number;
  token?: string;
}
interface AdminServer extends Omit<ServerSummary, "node"> {
  env?: Record<string, string>;
  memoryMB?: number;
  cpus?: number;
  node?: { name: string; host: string } | null;
}

/* ---------------- shared bits ---------------- */

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- root ---------------- */

const TABS = ["users", "nodes", "servers"] as const;
type Tab = (typeof TABS)[number];

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="page-sub">Manage users, nodes and servers</p>
        </div>
      </div>
      <div className="tab-nav">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "users" && <UsersTab />}
      {tab === "nodes" && <NodesTab />}
      {tab === "servers" && <ServersTab />}
    </div>
  );
}

/* ---------------- users tab ---------------- */

function UsersTab() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ users?: AdminUser[] } | AdminUser[]>("/api/admin/users");
      setUsers(Array.isArray(data) ? data : (data.users ?? []));
    } catch (e) {
      toast.pushError(e);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function del(u: AdminUser) {
    if (!window.confirm(`Delete user ${u.email}?`)) return;
    try {
      await api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "DELETE" });
      toast.push("User deleted", "success");
      void load();
    } catch (e) {
      toast.pushError(e);
    }
  }

  return (
    <div className="card table-card">
      <div className="table-toolbar">
        <span className="muted">{users?.length ?? 0} users</span>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + New user
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>User ID</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id}>
              <td>
                {u.email}
                {u.id === me?.id && <span className="pill">you</span>}
              </td>
              <td>
                <span className={`role-badge role-${u.role}`}>{u.role}</span>
              </td>
              <td className="mono muted">{u.id}</td>
              <td className="td-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>
                  Edit
                </button>
                <button className="btn btn-red btn-sm" onClick={() => void del(u)} disabled={u.id === me?.id}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding && (
        <Modal title="New user" onClose={() => setAdding(false)}>
          <UserForm
            submitLabel="Create user"
            onSubmit={async (body) => {
              await api("/api/admin/users", { method: "POST", body });
              toast.push("User created", "success");
            }}
            done={() => {
              setAdding(false);
              void load();
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${editing.email}`} onClose={() => setEditing(null)}>
          <UserForm
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (body) => {
              await api(`/api/admin/users/${encodeURIComponent(editing.id)}`, { method: "PATCH", body });
              toast.push("User updated", "success");
            }}
            done={() => {
              setEditing(null);
              void load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function UserForm({
  initial,
  submitLabel,
  onSubmit,
  done,
}: {
  initial?: AdminUser;
  submitLabel: string;
  onSubmit: (body: { email?: string; password?: string; role?: string }) => Promise<void>;
  done: () => void;
}) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial?.role ?? "user");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const body: { email?: string; password?: string; role?: string } = { role };
      if (!initial) body.email = email;
      if (password) body.password = password;
      if (initial && !password) delete body.password;
      await onSubmit(body);
      done();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="modal-form">
      <label className="field">
        <span>Email{initial && " (unchanged)"}</span>
        <input type="email" required={!initial} disabled={!!initial} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>{initial ? "Reset password (optional)" : "Password"}</span>
        <input
          type="password"
          required={!initial}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={initial ? "Leave blank to keep" : "At least 6 characters"}
        />
      </label>
      <label className="field">
        <span>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </label>
      {err && <div className="inline-alert">{err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={done}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/* ---------------- nodes tab ---------------- */

function NodesTab() {
  const toast = useToast();
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Node | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ nodes?: Node[] } | Node[]>("/api/admin/nodes");
      setNodes(Array.isArray(data) ? data : (data.nodes ?? []));
    } catch (e) {
      toast.pushError(e);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card table-card">
      <div className="table-toolbar">
        <span className="muted">{nodes?.length ?? 0} nodes</span>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + New node
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Host</th>
            <th>Daemon port</th>
            <th>Token</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {nodes?.map((n) => (
            <tr key={n.id}>
              <td>{n.name}</td>
              <td className="mono">{n.host}</td>
              <td>{n.daemonPort}</td>
              <td>
                {n.token ? (
                  <CopyableSecret token={n.token} />
                ) : (
                  <span className="muted">hidden</span>
                )}
              </td>
              <td className="td-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(n)}>
                  Edit
                </button>
                <button
                  className="btn btn-red btn-sm"
                  onClick={() => {
                    if (window.confirm(`Delete node ${n.name}?`))
                      void api(`/api/admin/nodes/${encodeURIComponent(n.id)}`, { method: "DELETE" })
                        .then(() => {
                          toast.push("Node deleted", "success");
                          return load();
                        })
                        .catch((e) => toast.pushError(e));
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding && (
        <Modal title="New node" onClose={() => setAdding(false)}>
          <NodeForm
            submitLabel="Create node"
            onSubmit={async (body) => {
              await api("/api/admin/nodes", { method: "POST", body });
              toast.push("Node created", "success");
            }}
            done={() => {
              setAdding(false);
              void load();
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <NodeForm
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (body) => {
              await api(`/api/admin/nodes/${encodeURIComponent(editing.id)}`, { method: "PATCH", body });
              toast.push("Node updated", "success");
            }}
            done={() => {
              setEditing(null);
              void load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function CopyableSecret({ token }: { token: string }) {
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);
  const display = useMemo(() => {
    if (revealed) return token;
    return `${token.slice(0, 4)}${"•".repeat(Math.max(4, Math.min(token.length - 8, 16)))}${token.slice(-4)}`;
  }, [token, revealed]);
  return (
    <span className="secret">
      <input
        className="mono secret-input"
        readOnly
        value={display}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button className="btn btn-ghost btn-sm" title="Reveal" onClick={() => setRevealed((v) => !v)}>
        {revealed ? "🙈" : "👁"}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        title="Copy"
        onClick={() => {
          void navigator.clipboard
            .writeText(token)
            .then(() => toast.push("Token copied", "success"))
            .catch(() => toast.push("Copy failed", "error"));
        }}
      >
        ⧉
      </button>
    </span>
  );
}

function NodeForm({
  initial,
  submitLabel,
  onSubmit,
  done,
}: {
  initial?: Node;
  submitLabel: string;
  onSubmit: (body: { name: string; host: string; daemonPort: number; token?: string }) => Promise<void>;
  done: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [daemonPort, setDaemonPort] = useState(String(initial?.daemonPort ?? 8080));
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const body: { name: string; host: string; daemonPort: number; token?: string } = {
        name,
        host,
        daemonPort: Number(daemonPort) || 8080,
      };
      if (token) body.token = token;
      await onSubmit(body);
      done();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="modal-form">
      <label className="field">
        <span>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="eu-west-1" />
      </label>
      <label className="field">
        <span>Host</span>
        <input required value={host} onChange={(e) => setHost(e.target.value)} placeholder="10.0.0.5" />
      </label>
      <label className="field">
        <span>Daemon port</span>
        <input type="number" value={daemonPort} onChange={(e) => setDaemonPort(e.target.value)} />
      </label>
      <label className="field">
        <span>{initial ? "Token (leave blank to keep)" : "Token"}</span>
        <input
          className="mono"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={initial ? "Leave blank to keep" : "Shared daemon secret"}
        />
      </label>
      {err && <div className="inline-alert">{err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={done}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/* ---------------- servers tab ---------------- */

function ServersTab() {
  const toast = useToast();
  const [servers, setServers] = useState<AdminServer[] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminServer | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, u, n] = await Promise.all([
        api<{ servers?: AdminServer[] } | AdminServer[]>("/api/admin/servers"),
        api<{ users?: AdminUser[] } | AdminUser[]>("/api/admin/users"),
        api<{ nodes?: Node[] } | Node[]>("/api/admin/nodes"),
      ]);
      setServers(Array.isArray(s) ? s : (s.servers ?? []));
      setUsers(Array.isArray(u) ? u : (u.users ?? []));
      setNodes(Array.isArray(n) ? n : (n.nodes ?? []));
    } catch (e) {
      toast.pushError(e);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card table-card">
      <div className="table-toolbar">
        <span className="muted">{servers?.length ?? 0} servers</span>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + New server
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>Node</th>
            <th>Image</th>
            <th>Port</th>
            <th>Status</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers?.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{users.find((u) => u.id === s.userId)?.email ?? <span className="muted">{s.userId}</span>}</td>
              <td>{nodes.find((n) => n.id === s.nodeId)?.name ?? <span className="muted">{s.nodeId}</span>}</td>
              <td className="mono trunc">{s.image}</td>
              <td>{s.port ?? "—"}</td>
              <td>
                <span className={`status-badge ${statusClass(s.status)}`}>{(s.status ?? "").toLowerCase() || "unknown"}</span>
              </td>
              <td className="td-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>
                  Edit
                </button>
                <button
                  className="btn btn-red btn-sm"
                  onClick={() => {
                    if (window.confirm(`Delete server ${s.name}?`))
                      void api(`/api/admin/servers/${encodeURIComponent(s.id)}`, { method: "DELETE" })
                        .then(() => {
                          toast.push("Server deleted", "success");
                          return load();
                        })
                        .catch((e) => toast.pushError(e));
                    }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding && (
        <Modal title="New server" onClose={() => setAdding(false)}>
          <ServerForm users={users} nodes={nodes} submitLabel="Create server" onSubmit={async (body) => {
            await api("/api/admin/servers", { method: "POST", body });
            toast.push("Server created", "success");
          }} done={() => { setAdding(false); void load(); }} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <ServerForm users={users} nodes={nodes} initial={editing} submitLabel="Save changes" onSubmit={async (body) => {
            await api(`/api/admin/servers/${encodeURIComponent(editing.id)}`, { method: "PATCH", body });
            toast.push("Server updated", "success");
          }} done={() => { setEditing(null); void load(); }} />
        </Modal>
      )}
    </div>
  );
}

function statusClass(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "running" || s === "started" || s === "online") return "badge-green";
  if (s === "stopped" || s === "exited" || s === "offline" || !s) return "badge-gray";
  if (s === "killed" || s === "error") return "badge-red";
  if (s === "starting" || s === "restarting") return "badge-blue";
  return "badge-yellow";
}

function ServerForm({
  users,
  nodes,
  initial,
  submitLabel,
  onSubmit,
  done,
}: {
  users: AdminUser[];
  nodes: Node[];
  initial?: AdminServer;
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  done: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [userId, setUserId] = useState(initial?.userId ?? "");
  const [nodeId, setNodeId] = useState(initial?.nodeId ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [port, setPort] = useState(initial?.port != null ? String(initial.port) : "");
  const [memoryMB, setMemoryMB] = useState(initial?.memoryMB != null ? String(initial.memoryMB) : "512");
  const [cpus, setCpus] = useState(initial?.cpus != null ? String(initial.cpus) : "1");
  // env as key=value list editor
  const [envEntries, setEnvEntries] = useState<{ k: string; v: string }[]>(
    Object.entries(initial?.env ?? {}).map(([k, v]) => ({ k, v: String(v) }))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const env: Record<string, string> = {};
      for (const { k, v } of envEntries) if (k.trim()) env[k.trim()] = v;
      const body: Record<string, unknown> = {
        name,
        userId,
        nodeId,
        image,
        env,
        port: port ? Number(port) : undefined,
        memoryMB: memoryMB ? Number(memoryMB) : undefined,
        cpus: cpus ? Number(cpus) : undefined,
      };
      await onSubmit(body);
      done();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="modal-form">
      <label className="field">
        <span>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="My Minecraft server" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Owner (user)</span>
          <select required value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="" disabled>
              Select user…
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Node</span>
          <select required value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
            <option value="" disabled>
              Select node…
            </option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Image</span>
        <input
          required
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="ghcr.io/library/minecraft"
          className="mono"
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Port</span>
          <input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="25565" />
        </label>
        <label className="field">
          <span>Memory (MB)</span>
          <input type="number" value={memoryMB} onChange={(e) => setMemoryMB(e.target.value)} />
        </label>
        <label className="field">
          <span>CPUs</span>
          <input type="number" step="0.1" value={cpus} onChange={(e) => setCpus(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>Environment variables</span>
        <div className="env-editor">
          {envEntries.map((entry, i) => (
            <div className="env-row" key={i}>
              <input
                value={entry.k}
                onChange={(e) => setEnvEntries((arr) => arr.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
                placeholder="KEY"
                className="mono"
              />
              <span className="env-eq">=</span>
              <input
                value={entry.v}
                onChange={(e) => setEnvEntries((arr) => arr.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
                placeholder="value"
                className="mono"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEnvEntries((arr) => arr.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEnvEntries((arr) => [...arr, { k: "", v: "" }])}>
            + Add variable
          </button>
        </div>
      </div>
      {err && <div className="inline-alert">{err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={done}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
