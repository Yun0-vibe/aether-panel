import React, { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { IconShield, IconLayers, IconServer, IconUsers, IconActivity, IconZap } from "../components/Icons";
import { RoleBadge } from "../components/RoleBadge";

export function AdminPortal() {
  const toast = useToast();
  const [users, setUsers] = useState<any[] | null>(null);
  const [nodes, setNodes] = useState<any[] | null>(null);
  const [servers, setServers] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, n, s] = await Promise.all([
        api<{ users?: any[] } | any[]>("/api/admin/users"),
        api<{ nodes?: any[] } | any[]>("/api/admin/nodes"),
        api<{ servers?: any[] } | any[]>("/api/admin/servers"),
      ]);
      setUsers(Array.isArray(u) ? u : (u.users ?? []));
      setNodes(Array.isArray(n) ? n : (n.nodes ?? []));
      setServers(Array.isArray(s) ? s : (s.servers ?? []));
    } catch (e) { toast.pushError(e); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const stats = {
    users: users?.length ?? 0,
    nodes: nodes?.length ?? 0,
    servers: servers?.length ?? 0,
    online: servers?.filter((s: any) => ["running", "online", "started"].includes((s.status ?? "").toLowerCase())).length ?? 0,
  };

  return (
    <div className="container">
      <div className="page-head mb-[24px]">
        <h1 className="page-title">Admin Portal</h1>
        <p className="page-sub">Full control over the panel, nodes and all users.</p>
      </div>

      <section className="stat-grid grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[14px] mb-[24px]">
        <StatTile icon={<IconUsers size={18} className="flex-none" />} label="Users" value={stats.users} tone="cyan" />
        <StatTile icon={<IconLayers size={18} className="flex-none" />} label="Nodes" value={stats.nodes} tone="violet" />
        <StatTile icon={<IconServer size={18} className="flex-none" />} label="Servers" value={stats.servers} tone="green" />
        <StatTile icon={<IconActivity size={18} className="flex-none" />} label="Online" value={stats.online} tone="slate" />
      </section>

      <div className="card mb-[16px]">
        <div className="flex items-center justify-between mb-[16px] gap-[12px]">
          <h2 className="text-[18px] font-bold">System Overview</h2>
          <button className="btn btn-primary btn-sm" onClick={() => { setBusy(true); setTimeout(() => { toast.push("Panel refreshed", "success"); setBusy(false); }, 800); }} disabled={busy}>
            {busy ? <span className="btn-spinner" /> : <IconZap size={15} className="flex-none" />}
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[14px]">
          <SystemPanel title="Node Status" value={`${stats.nodes} active`} sub="Daemon ports open" />
          <SystemPanel title="User Sessions" value={`${stats.users} registered`} sub="Active within 30 days" />
          <SystemPanel title="Server Health" value={`${stats.online}/${stats.servers}`} sub="Online / total assigned" />
        </div>
      </div>

      <div className="card mb-[16px]">
        <h3 className="text-[14px] font-bold tracking-[0.04em] uppercase text-text-2 mb-[14px]">Quick Actions</h3>
        <div className="flex flex-wrap gap-[10px]">
          <a href="/servers" className="btn btn-ghost btn-sm"><IconServer size={15} className="flex-none" /> Manage Servers</a>
          <a href="/admin?tab=users" className="btn btn-ghost btn-sm"><IconUsers size={15} className="flex-none" /> Manage Users</a>
          <a href="/admin?tab=nodes" className="btn btn-ghost btn-sm"><IconLayers size={15} className="flex-none" /> Manage Nodes</a>
          <a href="/" className="btn btn-ghost btn-sm"><IconActivity size={15} className="flex-none" /> User Dashboard</a>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "cyan" | "green" | "slate" | "violet" }) {
  return (
    <div className={`stat-tile relative overflow-hidden flex items-center gap-[13px] px-4 py-4 rounded-[18px] border border-border bg-surface backdrop-blur-[16px] -webkit-backdrop-blur-[16px] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:border-brand/60 hover:shadow-[0_22px_44px_-24px_rgba(0,0,0,0.85)]`}>
      <span className={`stat-icon flex-none w-[40px] h-[40px] grid place-items-center rounded-[12px] border border-white/10 bg-white/4 ${tone === "cyan" ? "text-sky-300 bg-brand/11 border-brand/26" : tone === "green" ? "text-green-400 bg-green/11 border-green/26" : tone === "slate" ? "text-slate-400 bg-slate/10 border-slate/24" : "text-fuchsia-300 bg-violet/12 border-violet/28"}`}>{icon}</span>
      <div className="stat-body flex flex-col leading-[1.2]">
        <span className="stat-value text-[25px] font-display font-black tracking-[-0.03em]">{value}</span>
        <span className="stat-label mt-[3px] text-[11.5px] font-bold tracking-[0.04em] uppercase text-text-3">{label}</span>
      </div>
      <span className="stat-sheen absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)] -translate-x-full transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none group-hover:translate-x-full" />
    </div>
  );
}

function SystemPanel({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="card relative overflow-hidden p-5 rounded-[18px] border border-border bg-gradient-to-b from-[rgba(14,20,36,0.72)] to-[rgba(11,16,29,0.72)] backdrop-blur-[12px] -webkit-backdrop-blur-[12px]">
      <h4 className="text-[13px] font-bold tracking-[0.04em] uppercase text-text-2 mb-[12px]">{title}</h4>
      <div className="text-[28px] font-display font-black tracking-[-0.03em] text-white">{value}</div>
      <p className="text-[11.5px] text-text-3 mt-[6px]">{sub}</p>
    </div>
  );
}
