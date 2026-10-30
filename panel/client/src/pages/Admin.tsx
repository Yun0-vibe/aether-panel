import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { ServerSummary, User } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { IconClose, IconPlus, IconUsers, IconLayers, IconServer } from "../components/Icons";
import { RoleBadge } from "../components/RoleBadge";

interface AdminUser extends User { createdAt?: string; }
interface Node { id: string; name: string; host: string; daemonPort: number; token?: string; }
interface AdminServer extends Omit<ServerSummary, "node"> {
  env?: Record<string, string>; memoryMB?: number; cpus?: number; ports?: EggPort[];
  node?: { name: string; host: string } | null;
}
interface EggPort { port: number; protocol: string; }
interface Egg { id: string; name: string; description?: string; image: string; ports?: EggPort[]; env?: Record<string, string>; memoryMB?: number; cpus?: number; }

const TABS = ["users", "nodes", "servers"] as const;
type Tab = (typeof TABS)[number];
const TAB_META: Record<Tab, { label: string; icon: React.ReactNode }> = {
  users: { label: "Users", icon: <IconUsers size={16} className="flex-none" /> },
  nodes: { label: "Nodes", icon: <IconLayers size={16} className="flex-none" /> },
  servers: { label: "Servers", icon: <IconServer size={16} className="flex-none" /> },
};

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#03060e]/72 backdrop-blur-[10px] -webkit-backdrop-blur-[10px] animate-[fade-in_220ms_var(--ease)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal w-full max-w-[580px] rounded-[24px] bg-gradient-to-b from-[rgba(18,25,43,0.97)] to-[rgba(12,17,31,0.97)] border border-white/12 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] animate-[modal-in_320ms_var(--ease)] overflow-hidden flex flex-col">
        <div className="modal-head sticky top-0 z-1 flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-[rgba(18,25,43,0.96)] backdrop-blur-[10px] -webkit-backdrop-blur-[10px]">
          <h3 className="text-sm font-bold">{title}</h3>
          <button className="flex-none w-8 h-8 grid place-items-center rounded-md border border-transparent text-text-3 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]" onClick={onClose} aria-label="Close">
            <IconClose size={16} className="flex-none" />
          </button>
        </div>
        <div className="modal-form p-5">{children}</div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = requested === "nodes" || requested === "servers" ? requested : "users";
  function setTab(t: Tab) { setParams(t === "users" ? {} : { tab: t }, { replace: true }); }

  return (
    <div className="container">
      <div className="page-head mb-[22px]">
        <div>
          <h1 className="page-title text-[clamp(26px,3vw,34px)] font-black brand-grad grad-text">Administration</h1>
          <p className="mt-[6px] text-[13.5px] text-text-2">Manage users, nodes and servers</p>
        </div>
      </div>
      <div className="tab-nav flex gap-[4px] mb-[18px] border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} className={`tab relative h-[40px] px-[15px] border-r rounded-[10px]_rounded-[10px]_0_0 text-[13px] font-bold whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${tab === t ? "text-brand" : "text-text-3"} hover:text-white hover:bg-white/4`} onClick={() => setTab(t)}>
            {TAB_META[t].icon} {TAB_META[t].label}
          </button>
        ))}
      </div>
      {tab === "users" && <UsersTab />}
      {tab === "nodes" && <NodesTab />}
      {tab === "servers" && <ServersTab />}
    </div>
  );
}

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
    } catch (e) { toast.pushError(e); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  async function del(u: AdminUser) {
    if (!window.confirm(`Delete user ${u.email}?`)) return;
    try {
      await api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "DELETE" });
      toast.push("User deleted", "success");
      void load();
    } catch (e) { toast.pushError(e); }
  }

  return (
    <div className="card table-card overflow-hidden">
      <div className="table-toolbar flex items-center justify-between gap-[12px] px-[15px] py-[13px] border-b border-border bg-white/1">
        <span className="muted text-[12.5px] font-bold">{users?.length ?? 0} users</span>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><IconPlus size={16} className="flex-none" /> New user</button>
      </div>
      <table className="table">
        <thead><tr><th>Email</th><th>Role</th><th>User ID</th><th className="th-actions">Actions</th></tr></thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id}>
              <td>{u.email}{u.id === me?.id && <span className="pill ml-[6px] inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[9.5px] font-black tracking-wider uppercase text-text-2 bg-white/7">you</span>}</td>
              <td><RoleBadge role={u.role} /></td>
              <td className="mono muted text-[13px]">{u.id}</td>
              <td className="td-actions flex justify-end gap-[6px]">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
                <button className="btn btn-red btn-sm" onClick={() => void del(u)} disabled={u.id === me?.id}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding && <Modal title="New user" onClose={() => setAdding(false)}><UserForm submitLabel="Create user" onSubmit={async (body) => { await api("/api/admin/users", { method: "POST", body }); toast.push("User created", "success"); }} done={() => { setAdding(false); void load(); }} /></Modal>}
      {editing && <Modal title={`Edit ${editing.email}`} onClose={() => setEditing(null)}><UserForm initial={editing} submitLabel="Save changes" onSubmit={async (body) => { await api(`/api/admin/users/${encodeURIComponent(editing.id)}`, { method: "PATCH", body }); toast.push("User updated", "success"); }} done={() => { setEditing(null); void load(); }} /></Modal>}
    </div>
  );
}

function UserForm({ initial, submitLabel, onSubmit, done }: { initial?: AdminUser; submitLabel: string; onSubmit: (body: { email: string; password?: string; role: string }) => void | Promise<void>; done: () => void; }) {
  const toast = useToast();
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial?.role ?? "user");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await onSubmit({ email, password, role }); done(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed to save user"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="modal-form">
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Email</span><div className="field-input-wrap relative flex items-center"><span className="field-icon absolute left-[12px] text-text-3 pointer-events-none">@</span><input className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Password</span><div className="field-input-wrap relative flex items-center"><IconPlus size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Role</span><select className="w-full h-[40px] px-[12px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={role} onChange={(e) => setRole(e.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></label>
      {err && <div className="inline-alert flex items-center gap-[8px] px-[13px] py-[10px] rounded-lg text-red-400 bg-red/10 border border-red/30 text-[12.5px]">{err}</div>}
      <div className="modal-actions flex justify-end gap-[9px] mt-[4px]"><button type="button" className="btn btn-ghost" onClick={done}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{submitLabel}</button></div>
    </form>
  );
}

function NodesTab() {
  const toast = useToast();
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Node | null>(null);

  const load = useCallback(async () => {
    try { const data = await api<{ nodes?: Node[] } | Node[]>("/api/admin/nodes"); setNodes(Array.isArray(data) ? data : (data.nodes ?? [])); } catch (e) { toast.pushError(e); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  async function del(n: Node) {
    if (!window.confirm(`Delete node ${n.name}?`)) return;
    try { await api(`/api/admin/nodes/${encodeURIComponent(n.id)}`, { method: "DELETE" }); toast.push("Node deleted", "success"); void load(); } catch (e) { toast.pushError(e); }
  }

  return (
    <div className="card table-card overflow-hidden">
      <div className="table-toolbar flex items-center justify-between gap-[12px] px-[15px] py-[13px] border-b border-border bg-white/1">
        <span className="muted text-[12.5px] font-bold">{nodes?.length ?? 0} nodes</span>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><IconPlus size={16} className="flex-none" /> New node</button>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Host</th><th>Daemon port</th><th>Token</th><th className="th-actions">Actions</th></tr></thead>
        <tbody>
          {nodes?.map((n) => (
            <tr key={n.id}>
              <td>{n.name}</td><td className="mono text-[13px]">{n.host}</td><td className="mono text-[13px]">{n.daemonPort}</td><td className="secret flex items-center gap-[6px]"><span className="mono text-[11.5px] trunc max-w-[190px] bg-[#000]/30 border border-border rounded-lg px-[9px] py-[5px] text-[11.5px]">{n.token ?? "—"}</span></td><td className="td-actions flex justify-end gap-[6px]"><button className="btn btn-ghost btn-sm" onClick={() => setEditing(n)}>Edit</button><button className="btn btn-red btn-sm" onClick={() => void del(n)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding && <Modal title="New node" onClose={() => setAdding(false)}><NodeForm onSubmit={async (body) => { await api("/api/admin/nodes", { method: "POST", body }); toast.push("Node created", "success"); }} done={() => { setAdding(false); void load(); }} /></Modal>}
      {editing && <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><NodeForm initial={editing} onSubmit={async (body) => { await api(`/api/admin/nodes/${encodeURIComponent(editing.id)}`, { method: "PATCH", body }); toast.push("Node updated", "success"); }} done={() => { setEditing(null); void load(); }} /></Modal>}
    </div>
  );
}

function NodeForm({ initial, onSubmit, done }: { initial?: Node; onSubmit: (body: Partial<Node>) => void | Promise<void>; done: () => void; }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [daemonPort, setDaemonPort] = useState(initial?.daemonPort ?? 8080);
  const [token, setToken] = useState(initial?.token ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await onSubmit({ name, host, daemonPort, token }); done(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed to save node"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="modal-form">
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Name</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Host</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={host} onChange={(e) => setHost(e.target.value)} required /></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Daemon port</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" type="number" value={daemonPort} onChange={(e) => setDaemonPort(Number(e.target.value) || 8080)} required /></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Node token</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={token} onChange={(e) => setToken(e.target.value)} required /></label>
      {err && <div className="inline-alert flex items-center gap-[8px] px-[13px] py-[10px] rounded-lg text-red-400 bg-red/10 border border-red/30 text-[12.5px]">{err}</div>}
      <div className="modal-actions flex justify-end gap-[9px] mt-[4px]"><button type="button" className="btn btn-ghost" onClick={done}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{initial ? "Save node" : "Create node"}</button></div>
    </form>
  );
}

function ServersTab() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [servers, setServers] = useState<AdminServer[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [nodes, setNodes] = useState<Node[] | null>(null);
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
    } catch (e) { toast.pushError(e); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  async function del(s: AdminServer) {
    if (!window.confirm(`Delete server ${s.name}?`)) return;
    try { await api(`/api/admin/servers/${encodeURIComponent(s.id)}`, { method: "DELETE" }); toast.push("Server deleted", "success"); void load(); } catch (e) { toast.pushError(e); }
  }

  const statusClass = (st?: string | null) => {
    const s = (st ?? "").toLowerCase();
    return s === "running" || s === "started" || s === "online" ? "badge-green" : s === "stopped" || s === "exited" || s === "" || s === "offline" ? "badge-gray" : s === "starting" || s === "restarting" ? "badge-blue" : s === "killed" || s === "error" ? "badge-red" : "badge-yellow";
  };

  return (
    <div className="card table-card overflow-hidden">
      <div className="table-toolbar flex items-center justify-between gap-[12px] px-[15px] py-[13px] border-b border-border bg-white/1">
        <span className="muted text-[12.5px] font-bold">{servers?.length ?? 0} servers</span>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><IconPlus size={16} className="flex-none" /> New server</button>
      </div>
      <table className="table">
        <thead><tr><th>Owner</th><th>Name</th><th>Image</th><th>Ports</th><th>Status</th><th className="th-actions">Actions</th></tr></thead>
        <tbody>
          {servers?.map((s) => {
            const owner = users?.find((u) => u.id === s.userId)?.email ?? s.userId;
            const node = nodes?.find((n) => n.id === s.nodeId);
            return (
              <tr key={s.id}>
                <td>{owner}</td>
                <td>{s.name}</td>
                <td className="mono trunc text-[13px]">{s.image}</td>
                <td className="row-ports flex flex-wrap gap-[4px]">{s.ports?.map((p) => (<span className="px-[2px] py-[1px] rounded-[4px] text-[10px] font-bold text-text-2 bg-white/4 border border-border" key={`${p.port}-${p.protocol}`}>{p.port}/{p.protocol}</span>))}</td>
                <td><span className={`status-badge ${statusClass(s.status)}`}>{(s.status ?? "").toLowerCase() || "unknown"}</span></td>
                <td className="td-actions flex justify-end gap-[6px]"><button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button><button className="btn btn-red btn-sm" onClick={() => void del(s)}>Delete</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {adding && <Modal title="New server" onClose={() => setAdding(false)}><ServerForm onSubmit={async (body) => { await api("/api/admin/servers", { method: "POST", body }); toast.push("Server created", "success"); }} done={() => { setAdding(false); void load(); }} eggs={[]} users={users ?? []} nodes={nodes ?? []} /></Modal>}
      {editing && <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><ServerForm initial={editing} onSubmit={async (body) => { await api(`/api/admin/servers/${encodeURIComponent(editing.id)}`, { method: "PATCH", body }); toast.push("Server updated", "success"); }} done={() => { setEditing(null); void load(); }} eggs={[]} users={users ?? []} nodes={nodes ?? []} /></Modal>}
    </div>
  );
}

function ServerForm({ initial, onSubmit, done, eggs, users, nodes }: { initial?: AdminServer; onSubmit: (body: Partial<AdminServer>) => void | Promise<void>; done: () => void; eggs: Egg[]; users: AdminUser[]; nodes: Node[]; }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [userId, setUserId] = useState(initial?.userId ?? "");
  const [nodeId, setNodeId] = useState(initial?.nodeId ?? "");
  const [memoryMB, setMemoryMB] = useState(String(initial?.memoryMB ?? ""));
  const [cpus, setCpus] = useState(String(initial?.cpus ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await onSubmit({ name, image, userId, nodeId, memoryMB: Number(memoryMB) || undefined, cpus: Number(cpus) || undefined }); done(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed to save server"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="modal-form">
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Name</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Image</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={image} onChange={(e) => setImage(e.target.value)} required /></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Owner</span><select className="w-full h-[40px] px-[12px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={userId} onChange={(e) => setUserId(e.target.value)} required>{users.map((u) => (<option key={u.id} value={u.id}>{u.email}</option>))}</select></label>
      <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Node</span><select className="w-full h-[40px] px-[12px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" value={nodeId} onChange={(e) => setNodeId(e.target.value)} required>{nodes.map((n) => (<option key={n.id} value={n.id}>{n.name}</option>))}</select></label>
      <div className="field-row grid grid-cols-[1fr_1fr] gap-[12px]">
        <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Memory (MB)</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" type="number" value={memoryMB} onChange={(e) => setMemoryMB(e.target.value)} /></label>
        <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">CPUs</span><input className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" type="number" value={cpus} onChange={(e) => setCpus(e.target.value)} /></label>
      </div>
      {err && <div className="inline-alert flex items-center gap-[8px] px-[13px] py-[10px] rounded-lg text-red-400 bg-red/10 border border-red/30 text-[12.5px]">{err}</div>}
      <div className="modal-actions flex justify-end gap-[9px] mt-[4px]"><button type="button" className="btn btn-ghost" onClick={done}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{initial ? "Save server" : "Create server"}</button></div>
    </form>
  );
}
