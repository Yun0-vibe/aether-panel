import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { ServerSummary, User } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { IconClose, IconPlus, IconUsers, IconLayers, IconServer, IconActivity, IconZap, IconShield, IconRocket, IconArchive } from "../components/Icons";
import { RoleBadge } from "../components/RoleBadge";

type AdminUser = User;
interface Node { id: string; name: string; host: string; daemonPort: number; token?: string; }
interface AdminServer extends Omit<ServerSummary, "node"> {
  env?: Record<string, string>; memoryMB?: number; cpus?: number; ports?: EggPort[];
  node?: { name: string; host: string } | null;
}
interface EggPort { port: number; protocol: string; }
interface NodeHealth { id: string; name: string; online: boolean; serverCount: number; version: string | null; }
interface Egg { id: string; name: string; description?: string; image: string; ports?: EggPort[]; env?: Record<string, string>; memoryMB?: number; cpus?: number; }

function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-[22px]">
      <h1 className="page-title bg-gradient-to-r from-[#22d3ee] via-[#3b82f6] to-[#a855f7] bg-clip-text text-[clamp(26px,3vw,34px)] font-black tracking-tight text-transparent">{title}</h1>
      <p className="mt-[6px] text-[13.5px] text-text-2">{sub}</p>
    </div>
  );
}

export function AdminOverview() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [servers, setServers] = useState<AdminServer[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, n, s] = await Promise.all([
        api<{ users?: AdminUser[] } | AdminUser[]>("/api/admin/users"),
        api<{ nodes?: Node[] } | Node[]>("/api/admin/nodes"),
        api<{ servers?: AdminServer[] } | AdminServer[]>("/api/admin/servers"),
      ]);
      setUsers(Array.isArray(u) ? u : (u.users ?? []));
      setNodes(Array.isArray(n) ? n : (n.nodes ?? []));
      setServers(Array.isArray(s) ? s : (s.servers ?? []));
    } catch (e) { toast.pushError(e); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const online = (servers ?? []).filter((s) => ["running", "started", "online"].includes((s.status ?? "").toLowerCase())).length;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHead title="Admin overview" sub="Everything happening across the panel, at a glance." />

      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[14px]">
        <OverviewStat tone="violet" icon={<IconUsers size={18} className="flex-none" />} label="Users" value={users?.length ?? 0} />
        <OverviewStat tone="blue" icon={<IconLayers size={18} className="flex-none" />} label="Nodes" value={nodes?.length ?? 0} />
        <OverviewStat tone="cyan" icon={<IconServer size={18} className="flex-none" />} label="Servers" value={servers?.length ?? 0} />
        <OverviewStat tone="green" icon={<IconActivity size={18} className="flex-none" />} label="Online" value={online} />
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[14px]">
        <QuickCard to="/admin/servers/new" icon={<IconRocket size={20} className="flex-none" />} title="Create server" sub="Wizard with game presets" />
        <QuickCard to="/admin/eggs" icon={<IconArchive size={20} className="flex-none" />} title="Eggs & nests" sub="Game presets for the wizard" />
        <QuickCard to="/admin/users" icon={<IconUsers size={20} className="flex-none" />} title="Manage users" sub="Create, promote or remove accounts" />
        <QuickCard to="/admin/nodes" icon={<IconLayers size={20} className="flex-none" />} title="Manage nodes" sub="Register daemon machines" />
        <QuickCard to="/admin/servers" icon={<IconServer size={20} className="flex-none" />} title="Manage servers" sub="Provision and assign game servers" />
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-[12px] border-b border-border px-[15px] py-[13px] bg-white/1">
          <span className="text-[12.5px] font-bold text-text-2">Latest servers</span>
          <Link to="/admin/servers" className="text-[12px] font-semibold text-brand transition-colors hover:text-sky-300">View all</Link>
        </div>
        <table className="table">
          <thead><tr><th>Name</th><th>Image</th><th>Status</th></tr></thead>
          <tbody>
            {(servers ?? []).slice(0, 5).map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.name}</td>
                <td className="mono trunc max-w-[280px]">{s.image}</td>
                <td><span className={`status-badge ${["running", "started", "online"].includes((s.status ?? "").toLowerCase()) ? "badge-green" : "badge-gray"}`}>{(s.status ?? "unknown").toLowerCase()}</span></td>
              </tr>
            ))}
            {servers !== null && servers.length === 0 && (
              <tr><td colSpan={3} className="text-center text-text-3 text-[13px] py-7">No servers provisioned yet</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function OverviewStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "cyan" | "green" | "slate" | "violet" | "blue" }) {
  const tones: Record<string, string> = {
    cyan: "text-sky-300 bg-[rgba(34,211,238,0.11)] border-[rgba(34,211,238,0.26)]",
    green: "text-green-400 bg-[rgba(52,211,153,0.11)] border-[rgba(52,211,153,0.26)]",
    slate: "text-slate-400 bg-[rgba(148,163,184,0.1)] border-[rgba(148,163,184,0.24)]",
    violet: "text-fuchsia-300 bg-[rgba(168,85,247,0.12)] border-[rgba(168,85,247,0.28)]",
    blue: "text-blue-300 bg-[rgba(59,130,246,0.12)] border-[rgba(59,130,246,0.28)]",
  };
  return (
    <article className="relative flex items-center gap-[13px] overflow-hidden rounded-[18px] border border-border bg-surface px-[16px] py-[18px] backdrop-blur-md transition-all duration-200 hover:-translate-y-[3px] hover:border-brand/60 hover:shadow-[0_22px_44px_-24px_rgba(0,0,0,0.85)]">
      <span className={`flex h-[40px] w-[40px] flex-none place-items-center rounded-[12px] border border-white/10 ${tones[tone]}`}>{icon}</span>
      <div className="flex flex-col leading-[1.2]">
        <span className="font-display text-[25px] font-black tracking-[-0.03em]">{value}</span>
        <span className="mt-[3px] text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-3">{label}</span>
      </div>
    </article>
  );
}

function QuickCard({ to, icon, title, sub }: { to: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link to={to} className="glass group flex items-center gap-[14px] p-5 rounded-[18px] transition-all duration-200 hover:-translate-y-[3px] hover:border-fuchsia-400/50 hover:shadow-[0_22px_44px_-24px_rgba(168,85,247,0.55)]">
      <span className="flex h-[44px] w-[44px] flex-none place-items-center rounded-[13px] bg-[rgba(168,85,247,0.12)] border border-[rgba(168,85,247,0.28)] text-fuchsia-300 transition-transform duration-200 group-hover:scale-110">{icon}</span>
      <div className="min-w-0 flex flex-col">
        <span className="text-[14.5px] font-bold text-white">{title}</span>
        <span className="mt-[2px] text-[12px] text-text-3">{sub}</span>
      </div>
      <IconZap size={16} className="ml-auto flex-none text-text-3 transition-all duration-200 group-hover:text-fuchsia-300" />
    </Link>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#03060e]/70 p-6 backdrop-blur-[10px] animate-[fade-in_220ms_var(--ease)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-[580px] flex-col overflow-hidden rounded-[24px] border border-white/12 bg-gradient-to-b from-[rgba(18,25,43,0.97)] to-[rgba(12,17,31,0.97)] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] animate-[modal-in_320ms_var(--ease)]">
        <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border bg-[rgba(18,25,43,0.96)] px-5 py-4 backdrop-blur-md">
          <h3 className="text-sm font-bold">{title}</h3>
          <button className="flex h-8 w-8 flex-none place-items-center rounded-md text-text-3 transition-colors hover:bg-white/5 hover:text-white" onClick={onClose} aria-label="Close modal">
            <IconClose size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const FIELD = "h-[40px] w-full rounded-lg border border-border bg-[rgba(0,0,0,0.26)] px-[13px] text-[13.5px] text-white outline-none transition-all duration-150 focus:border-brand/60 focus:bg-[rgba(34,211,238,0.05)]";

export function UsersTab() {
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
    <div className="flex flex-col gap-[18px]">
      <PageHead title="Users" sub="Accounts, roles and access to the panel." />
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border bg-white/1 px-[15px] py-[13px]">
          <span className="text-[12.5px] font-bold text-text-2">{users?.length ?? 0} users</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><IconPlus size={15} className="flex-none" /> New user</button>
        </div>
        <table className="table">
          <thead><tr><th>Email</th><th>Role</th><th>User ID</th><th className="th-actions">Actions</th></tr></thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.email}{u.id === me?.id && <span className="ml-[6px] rounded-full border border-border bg-white/7 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-text-2">you</span>}</td>
                <td><RoleBadge role={u.role} /></td>
                <td className="mono text-[13px] text-text-2">{u.id}</td>
                <td className="td-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
                  <button className="btn btn-red btn-sm" onClick={() => void del(u)} disabled={u.id === me?.id}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <Modal title="New user" onClose={() => setAdding(false)}><UserForm submitLabel="Create user" onSubmit={async (body) => { await api("/api/admin/users", { method: "POST", body }); toast.push("User created", "success"); }} done={() => { setAdding(false); void load(); }} /></Modal>}
      {editing && <Modal title={`Edit ${editing.email}`} onClose={() => setEditing(null)}><UserForm initial={editing} submitLabel="Save changes" onSubmit={async (body) => { await api(`/api/admin/users/${encodeURIComponent(editing.id)}`, { method: "PATCH", body }); toast.push("User updated", "success"); }} done={() => { setEditing(null); void load(); }} /></Modal>}
    </div>
  );
}

function UserForm({ initial, submitLabel, onSubmit, done }: { initial?: AdminUser; submitLabel: string; onSubmit: (body: { email: string; password?: string; role: string }) => void | Promise<void>; done: () => void; }) {
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
    <form onSubmit={submit} className="flex flex-col gap-[15px]">
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Email</span><input className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Password{initial ? " (leave blank to keep)" : ""}</span><input className={FIELD} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!initial} minLength={initial ? 0 : 6} /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Role</span><select className={FIELD} value={role} onChange={(e) => setRole(e.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></label>
      {err && <div className="flex items-center gap-[8px] rounded-lg border border-red-500/30 bg-[rgba(248,113,113,0.1)] px-[13px] py-[10px] text-[12.5px] text-red-400">{err}</div>}
      <div className="mt-[4px] flex justify-end gap-[9px]">
        <button type="button" className="btn btn-ghost" onClick={done}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{submitLabel}</button>
      </div>
    </form>
  );
}

export function NodesTab() {
  const toast = useToast();
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [health, setHealth] = useState<NodeHealth[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Node | null>(null);

  const load = useCallback(async () => {
    try { const data = await api<{ nodes?: Node[] } | Node[]>("/api/admin/nodes"); setNodes(Array.isArray(data) ? data : (data.nodes ?? [])); } catch (e) { toast.pushError(e); }
  }, [toast]);

  const loadHealth = useCallback(async () => {
    try {
      const data = await api<{ nodes: NodeHealth[] }>("/api/admin/nodes/status");
      setHealth(data.nodes ?? []);
    } catch { setHealth(null); }
  }, []);

  useEffect(() => { void load(); void loadHealth(); const t = window.setInterval(loadHealth, 15_000); return () => window.clearInterval(t); }, [load, loadHealth]);

  const healthFor = (id: string) => health?.find((h) => h.id === id) ?? null;

  async function del(n: Node) {
    if (!window.confirm(`Delete node ${n.name}?`)) return;
    try { await api(`/api/admin/nodes/${encodeURIComponent(n.id)}`, { method: "DELETE" }); toast.push("Node deleted", "success"); void load(); } catch (e) { toast.pushError(e); }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead title="Nodes" sub="Machines running the Aether daemon." />

      {/* live health cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[14px]">
        {nodes === null && <div className="card p-6 text-[13px] text-text-3">Loading nodes…</div>}
        {nodes?.map((n) => {
          const h = healthFor(n.id);
          const loading = health === null;
          const online = h?.online === true;
          return (
            <article key={n.id} className={`relative flex flex-col gap-[10px] rounded-[18px] border p-[18px] transition-all duration-200 hover:-translate-y-[2px] ${online ? "border-green/30 bg-[rgba(20,40,32,0.45)] hover:shadow-[0_22px_44px_-26px_rgba(52,211,153,0.45)]" : "border-border bg-surface hover:shadow-[0_22px_44px_-26px_rgba(0,0,0,0.85)]"}`}>
              <div className="flex items-center justify-between gap-[10px]">
                <span className="flex items-center gap-[9px] min-w-0">
                  <IconLayers size={17} className={`flex-none ${online ? "text-green-400" : "text-text-3"}`} />
                  <span className="text-[15px] font-bold trunc">{n.name}</span>
                </span>
                <span className={`status-badge ${online ? "badge-green" : loading ? "badge-gray" : "badge-red"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-current ${online ? "animate-pulse shadow-[0_0_6px_currentColor]" : ""}`} />
                  {loading ? "checking…" : online ? "daemon online" : "daemon offline"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-[6px] text-[11.5px] text-text-2">
                <span className="mono trunc rounded-lg border border-border bg-[rgba(0,0,0,0.3)] px-[9px] py-[4px]">{n.host}:{n.daemonPort}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-[10px] text-[11.5px] text-text-3">
                <span>{(h?.serverCount ?? 0)} server{(h?.serverCount ?? 0) === 1 ? "" : "s"} hosted</span>
                {h?.version && <span className="mono trunc max-w-[70px]">{h.version.trim().slice(0, 8)}</span>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border bg-white/1 px-[15px] py-[13px]">
          <span className="text-[12.5px] font-bold text-text-2">{nodes?.length ?? 0} nodes</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><IconPlus size={15} className="flex-none" /> New node</button>
        </div>
        <table className="table">
          <thead><tr><th>Name</th><th>Host</th><th>Daemon port</th><th>Token</th><th className="th-actions">Actions</th></tr></thead>
          <tbody>
            {nodes?.map((n) => (
              <tr key={n.id}>
                <td className="font-semibold">{n.name}</td>
                <td className="mono text-[13px]">{n.host}</td>
                <td className="mono text-[13px]">{n.daemonPort}</td>
                <td><span className="mono block max-w-[190px] trunc rounded-lg border border-border bg-[rgba(0,0,0,0.3)] px-[9px] py-[5px] text-[11.5px]">{n.token ?? "—"}</span></td>
                <td className="td-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(n)}>Edit</button>
                  <button className="btn btn-red btn-sm" onClick={() => void del(n)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <Modal title="New node" onClose={() => setAdding(false)}><NodeForm onSubmit={async (body) => { await api("/api/admin/nodes", { method: "POST", body }); toast.push("Node created", "success"); }} done={() => { setAdding(false); void load(); }} /></Modal>}
      {editing && <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><NodeForm initial={editing} onSubmit={async (body) => { await api(`/api/admin/nodes/${encodeURIComponent(editing.id)}`, { method: "PATCH", body }); toast.push("Node updated", "success"); }} done={() => { setEditing(null); void load(); }} /></Modal>}
    </div>
  );
}

function NodeForm({ initial, onSubmit, done }: { initial?: Node; onSubmit: (body: Partial<Node>) => void | Promise<void>; done: () => void; }) {  const [name, setName] = useState(initial?.name ?? "");
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
    <form onSubmit={submit} className="flex flex-col gap-[15px]">
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Name</span><input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Host</span><input className={FIELD} value={host} onChange={(e) => setHost(e.target.value)} required /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Daemon port</span><input className={FIELD} type="number" value={daemonPort} onChange={(e) => setDaemonPort(Number(e.target.value) || 8080)} required /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Node token</span><input className={FIELD} value={token} onChange={(e) => setToken(e.target.value)} required /></label>
      {err && <div className="flex items-center gap-[8px] rounded-lg border border-red-500/30 bg-[rgba(248,113,113,0.1)] px-[13px] py-[10px] text-[12.5px] text-red-400">{err}</div>}
      <div className="mt-[4px] flex justify-end gap-[9px]">
        <button type="button" className="btn btn-ghost" onClick={done}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{initial ? "Save node" : "Create node"}</button>
      </div>
    </form>
  );
}

export function ServersTab() {
  const toast = useToast();
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

  const badgeFor = (st?: string | null) => {
    const s = (st ?? "").toLowerCase();
    if (["running", "started", "online"].includes(s)) return "badge-green";
    if (["stopped", "exited", "", "offline", "no-node"].includes(s)) return "badge-gray";
    if (["starting", "restarting", "created"].includes(s)) return "badge-blue";
    if (["killed", "error", "node-offline"].includes(s)) return "badge-red";
    return "badge-yellow";
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead title="Servers" sub="Provision and manage every game server." />
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border bg-white/1 px-[15px] py-[13px]">
          <span className="text-[12.5px] font-bold text-text-2">{servers?.length ?? 0} servers</span>
          <Link to="/admin/servers/new" className="btn btn-primary btn-sm"><IconPlus size={15} className="flex-none" /> New server</Link>
        </div>
        <table className="table">
          <thead><tr><th>Owner</th><th>Name</th><th>Image</th><th>Ports</th><th>Status</th><th className="th-actions">Actions</th></tr></thead>
          <tbody>
            {servers?.map((s) => {
              const owner = users?.find((u) => u.id === s.userId)?.email ?? s.userId;
              return (
                <tr key={s.id}>
                  <td className="font-semibold">{owner}</td>
                  <td>{s.name}</td>
                  <td className="mono trunc max-w-[240px] text-[13px]">{s.image}</td>
                  <td><div className="flex flex-wrap gap-[4px]">{s.ports?.map((p) => (<span className="rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px] text-[10px] font-bold text-text-2" key={`${p.port}-${p.protocol}`}>{p.port}/{p.protocol}</span>))}</div></td>
                  <td><span className={`status-badge ${badgeFor(s.status)}`}>{(s.status ?? "").toLowerCase() || "unknown"}</span></td>
                  <td className="td-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>
                    <button className="btn btn-red btn-sm" onClick={() => void del(s)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {adding && <Modal title="New server" onClose={() => setAdding(false)}><ServerForm onSubmit={async (body) => { await api("/api/admin/servers", { method: "POST", body }); toast.push("Server created", "success"); }} done={() => { setAdding(false); void load(); }} users={users ?? []} nodes={nodes ?? []} /></Modal>}
      {editing && <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><ServerForm initial={editing} onSubmit={async (body) => { await api(`/api/admin/servers/${encodeURIComponent(editing.id)}`, { method: "PATCH", body }); toast.push("Server updated", "success"); }} done={() => { setEditing(null); void load(); }} users={users ?? []} nodes={nodes ?? []} /></Modal>}
    </div>
  );
}

function ServerForm({ initial, onSubmit, done, users, nodes }: { initial?: AdminServer; onSubmit: (body: Partial<AdminServer>) => void | Promise<void>; done: () => void; users: AdminUser[]; nodes: Node[]; }) {
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
    <form onSubmit={submit} className="flex flex-col gap-[15px]">
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Name</span><input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Docker image</span><input className={FIELD} value={image} onChange={(e) => setImage(e.target.value)} required /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Owner</span><select className={FIELD} value={userId} onChange={(e) => setUserId(e.target.value)} required>{users.map((u) => (<option key={u.id} value={u.id}>{u.email}</option>))}</select></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Node</span><select className={FIELD} value={nodeId} onChange={(e) => setNodeId(e.target.value)} required>{nodes.map((n) => (<option key={n.id} value={n.id}>{n.name}</option>))}</select></label>
      <div className="grid grid-cols-2 gap-[12px]">
        <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Memory (MB)</span><input className={FIELD} type="number" value={memoryMB} onChange={(e) => setMemoryMB(e.target.value)} /></label>
        <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">CPUs</span><input className={FIELD} type="number" value={cpus} onChange={(e) => setCpus(e.target.value)} /></label>
      </div>
      <p className="flex items-start gap-[8px] rounded-lg border border-border bg-white/3 px-[13px] py-[10px] text-[11.5px] text-text-3"><IconShield size={15} className="mt-[1px] flex-none" /> Ports and environment come from the image defaults. Advanced egg presets arrive in a later update.</p>
      {err && <div className="flex items-center gap-[8px] rounded-lg border border-red-500/30 bg-[rgba(248,113,113,0.1)] px-[13px] py-[10px] text-[12.5px] text-red-400">{err}</div>}
      <div className="mt-[4px] flex justify-end gap-[9px]">
        <button type="button" className="btn btn-ghost" onClick={done}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{initial ? "Save server" : "Create server"}</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- eggs & nests

interface AdminNest { id: string; name: string; sort: number; eggCount: number }
interface AdminEgg {
  id: string;
  name: string;
  description: string;
  image: string;
  ports: EggPort[];
  env: Record<string, string>;
  memoryMB: number;
  cpus: number;
  sort?: number;
  nestId: string;
  nestName: string | null;
}

const ENV_FIELD =
  "w-full min-h-[120px] resize-y rounded-lg border border-border bg-[rgba(0,0,0,0.26)] px-[13px] py-[10px] font-mono text-[12.5px] leading-[1.7] text-white outline-none transition-all duration-150 focus:border-brand/60";

/** "25565/tcp, 19132/udp" -> [{port, protocol}] */
export function parsePortsText(text: string): EggPort[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [port, proto = "tcp"] = s.split("/");
      return { port: Number(port), protocol: proto.trim().toLowerCase() || "tcp" };
    })
    .filter((p) => Number.isInteger(Number(p.port)) && p.port > 0 && p.port <= 65535 && ["tcp", "udp"].includes(p.protocol));
}

/** "KEY=VALUE" lines -> object */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function EggsTab() {
  const toast = useToast();
  const [eggs, setEggs] = useState<AdminEgg[] | null>(null);
  const [nests, setNests] = useState<AdminNest[] | null>(null);
  const [eggModal, setEggModal] = useState<{ egg?: AdminEgg; nestId?: string } | null>(null);
  const [nestModal, setNestModal] = useState<AdminNest | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, n] = await Promise.all([
        api<{ eggs?: AdminEgg[] }>("/api/admin/eggs"),
        api<{ nests?: AdminNest[] }>("/api/admin/nests"),
      ]);
      setEgs(e.eggs ?? []);
      setNests(n.nests ?? []);
    } catch (err) { toast.pushError(err); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);
  function setEgs(list: AdminEgg[]) { setEggs(list); }

  async function delEgg(egg: AdminEgg) {
    if (!window.confirm(`Delete preset "${egg.name}"? Servers already created keep their image.`)) return;
    try { await api(`/api/admin/eggs/${encodeURIComponent(egg.id)}`, { method: "DELETE" }); toast.push("Egg deleted", "success"); void load(); }
    catch (err) { toast.pushError(err); }
  }

  async function delNest(nest: AdminNest) {
    if (!window.confirm(`Delete nest "${nest.name}"?`)) return;
    try { await api(`/api/admin/nests/${encodeURIComponent(nest.id)}`, { method: "DELETE" }); toast.push("Nest deleted", "success"); void load(); }
    catch (err) { toast.pushError(err instanceof ApiError ? err.message : "Failed — the nest may still have eggs"); }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, AdminEgg[]>();
    for (const e of eggs ?? []) {
      const list = map.get(e.nestId || "game-servers") ?? [];
      list.push(e);
      map.set(e.nestId || "game-servers", list);
    }
    return nests?.map((n) => ({ nest: n, eggs: map.get(n.id) ?? [] })) ?? [];
  }, [eggs, nests]);

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead title="Eggs & nests" sub="Game presets offered in the server creation wizard." />
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border bg-white/1 px-[15px] py-[13px]">
          <span className="text-[12.5px] font-bold text-text-2">{eggs?.length ?? 0} presets · {nests?.length ?? 0} nests</span>
          <div className="flex gap-[8px]">
            <button className="btn btn-ghost btn-sm" onClick={() => setNestModal("new")}><IconPlus size={15} className="flex-none" /> New nest</button>
            <button className="btn btn-primary btn-sm" onClick={() => setEggModal({ nestId: nests?.[0]?.id })}><IconPlus size={15} className="flex-none" /> New egg</button>
          </div>
        </div>

        <div className="flex flex-col gap-[20px] p-[15px]">
          {eggs === null && <div className="py-8 text-center text-[13px] text-text-3">Loading presets…</div>}
          {grouped.map(({ nest, eggs: list }) => (
            <section key={nest.id} className="flex flex-col gap-[10px]">
              <div className="flex items-center gap-[10px] border-b border-border pb-[9px]">
                <IconLayers size={15} className="flex-none text-fuchsia-300" />
                <h3 className="text-[14px] font-bold">{nest.name}</h3>
                <span className="rounded-full border border-border bg-white/4 px-[8px] py-[2px] text-[10px] font-bold text-text-3">{list.length} egg{list.length === 1 ? "" : "s"}</span>
                <div className="ml-auto flex gap-[6px]">
                  <button className="btn btn-ghost btn-sm" onClick={() => setNestModal(nest)}>Rename</button>
                  <button className="btn btn-red btn-sm" onClick={() => void delNest(nest)}>Delete</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEggModal({ nestId: nest.id })}><IconPlus size={14} className="flex-none" /> Egg</button>
                </div>
              </div>
              {list.length === 0 ? (
                <p className="text-[12px] text-text-3">No presets in this nest yet.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-[12px]">
                  {list.map((egg) => (
                    <article key={egg.id} className="flex flex-col gap-[8px] rounded-[16px] border border-border bg-surface-2 p-[15px] transition-all duration-200 hover:border-fuchsia-400/40 hover:-translate-y-[2px]">
                      <div className="flex items-center justify-between gap-[8px]">
                        <h4 className="trunc text-[14.5px] font-bold">{egg.name}</h4>
                        <div className="flex flex-none gap-[5px]">
                          <button className="btn btn-ghost btn-sm !px-2" onClick={() => setEggModal({ egg })} aria-label={`Edit ${egg.name}`}>Edit</button>
                          <button className="btn btn-red btn-sm !px-2" onClick={() => void delEgg(egg)} aria-label={`Delete ${egg.name}`}>✕</button>
                        </div>
                      </div>
                      <span className="mono trunc rounded-lg border border-border bg-[rgba(0,0,0,0.3)] px-[9px] py-[4px] text-[11px] text-text-3" title={egg.image}>{egg.image}</span>
                      <p className="min-h-[32px] text-[11.5px] leading-[1.5] text-text-2">{egg.description || "No description"}</p>
                      <div className="flex flex-wrap gap-[4px] text-[10.5px] font-bold text-text-3">
                        <span className="rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px]">{egg.memoryMB} MB</span>
                        <span className="rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px]">{egg.cpus} vCPU</span>
                        {(egg.ports ?? []).slice(0, 3).map((p) => (
                          <span key={`${p.port}-${p.protocol}`} className="rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px]">{p.port}/{p.protocol}</span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      {eggModal && (
        <Modal title={eggModal.egg ? `Edit ${eggModal.egg.name}` : "New egg"} onClose={() => setEggModal(null)}>
          <EggForm
            initial={eggModal.egg}
            defaultNestId={eggModal.nestId ?? nests?.[0]?.id}
            nests={nests ?? []}
            onSubmit={async (body) => {
              if (eggModal.egg) await api(`/api/admin/eggs/${encodeURIComponent(eggModal.egg.id)}`, { method: "PATCH", body });
              else await api("/api/admin/eggs", { method: "POST", body });
              toast.push(eggModal.egg ? "Egg updated" : "Egg created", "success");
            }}
            done={() => { setEggModal(null); void load(); }}
          />
        </Modal>
      )}
      {nestModal && (
        <Modal title={nestModal === "new" ? "New nest" : `Rename ${nestModal.name}`} onClose={() => setNestModal(null)}>
          <NestForm
            initial={nestModal === "new" ? undefined : nestModal}
            onSubmit={async (body) => {
              if (nestModal === "new") await api("/api/admin/nests", { method: "POST", body });
              else await api(`/api/admin/nests/${encodeURIComponent(nestModal.id)}`, { method: "PATCH", body });
              toast.push(nestModal === "new" ? "Nest created" : "Nest renamed", "success");
            }}
            done={() => { setNestModal(null); void load(); }}
          />
        </Modal>
      )}
    </div>
  );
}

function EggForm({ initial, defaultNestId, nests, onSubmit, done }: {
  initial?: AdminEgg;
  defaultNestId?: string;
  nests: AdminNest[];
  onSubmit: (body: Record<string, unknown>) => void | Promise<void>;
  done: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [nestId, setNestId] = useState(initial?.nestId ?? defaultNestId ?? "");
  const [memoryMB, setMemoryMB] = useState(String(initial?.memoryMB ?? 2048));
  const [cpus, setCpus] = useState(String(initial?.cpus ?? 1));
  const [sort, setSort] = useState(String(initial?.sort ?? 100));
  const [portsText, setPortsText] = useState((initial?.ports ?? []).map((p) => `${p.port}/${p.protocol}`).join(", "));
  const [envText, setEnvText] = useState(Object.entries(initial?.env ?? {}).map(([k, v]) => `${k}=${v}`).join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await onSubmit({
        name, image, description, nestId,
        memoryMB: Number(memoryMB) || 2048,
        cpus: Number(cpus) || 1,
        sort: Number(sort) || 100,
        ports: parsePortsText(portsText),
        env: parseEnvText(envText),
      });
      done();
    } catch (err) {
      setErr(err instanceof ApiError ? err.message : "Failed to save egg");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[14px]">
      <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
        <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Preset name</span><input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Minecraft Paper" /></label>
        <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Nest</span><select className={FIELD} value={nestId} onChange={(e) => setNestId(e.target.value)} required>{nests.map((n) => (<option key={n.id} value={n.id}>{n.name}</option>))}</select></label>
      </div>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Docker image</span><input className={FIELD + " font-mono !text-[12.5px]"} value={image} onChange={(e) => setImage(e.target.value)} required placeholder="itzg/minecraft-server" /></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Description</span><input className={FIELD} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description shown in the wizard" /></label>
      <div className="grid grid-cols-3 gap-[12px]">
        <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Memory (MB)</span><input className={FIELD} type="number" min={128} value={memoryMB} onChange={(e) => setMemoryMB(e.target.value)} /></label>
        <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">vCPUs</span><input className={FIELD} type="number" min={0.5} step={0.5} value={cpus} onChange={(e) => setCpus(e.target.value)} /></label>
        <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Sort order</span><input className={FIELD} type="number" value={sort} onChange={(e) => setSort(e.target.value)} /></label>
      </div>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Ports</span><input className={FIELD + " font-mono !text-[12.5px]"} value={portsText} onChange={(e) => setPortsText(e.target.value)} placeholder="25565/tcp, 19132/udp" /><span className="text-[11px] text-text-3">Comma-separated port/protocol list.</span></label>
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Environment variables</span><textarea className={ENV_FIELD} value={envText} onChange={(e) => setEnvText(e.target.value)} placeholder={"EULA=TRUE\nTYPE=PAPER"} /><span className="text-[11px] text-text-3">One KEY=VALUE per line; merged with user input at creation.</span></label>
      {err && <FormErrorInline msg={err} />}
      <div className="mt-[2px] flex justify-end gap-[9px]">
        <button type="button" className="btn btn-ghost" onClick={done}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{initial ? "Save egg" : "Create egg"}</button>
      </div>
    </form>
  );
}

function FormErrorInline({ msg }: { msg: string }) {
  return <div className="flex items-center gap-[8px] rounded-lg border border-red-500/30 bg-[rgba(248,113,113,0.1)] px-[13px] py-[10px] text-[12.5px] text-red-400">{msg}</div>;
}

function NestForm({ initial, onSubmit, done }: { initial?: AdminNest; onSubmit: (body: { name: string }) => void | Promise<void>; done: () => void; }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await onSubmit({ name }); done(); }
    catch (e2) { setErr(e2 instanceof ApiError ? e2.message : "Failed to save nest"); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-[14px]">
      <label className="flex flex-col gap-[7px]"><span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Nest name</span><input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Minecraft" /></label>
      {err && <FormErrorInline msg={err} />}
      <div className="flex justify-end gap-[9px]">
        <button type="button" className="btn btn-ghost" onClick={done}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{initial ? "Rename nest" : "Create nest"}</button>
      </div>
    </form>
  );
}
