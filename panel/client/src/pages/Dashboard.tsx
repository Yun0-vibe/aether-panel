import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { ServerSummary } from "../auth/AuthContext";
import { ServerCard, StatusBadge } from "../components/ServerCard";
import {
  IconActivity,
  IconChevronRight,
  IconCpu,
  IconLayers,
  IconServer,
  IconSparkle,
  IconZap,
} from "../components/Icons";

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
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const list = servers ?? [];
    const running = list.filter((s) => ["running", "started", "online"].includes((s.status ?? "").toLowerCase())).length;
    const nodes = new Set(list.map((s) => s.nodeId ?? s.node?.name ?? "")).size;
    return { total: list.length, running, stopped: list.length - running, nodes };
  }, [servers]);

  if (err) {
    return (
      <div className="container">
        <div className="card p-6 text-center">{err}</div>
      </div>
    );
  }

  const firstName = (user?.email ?? "").split("@")[0];

  return (
    <div className="container dash flex flex-col gap-[24px]">
      <section className="hero relative overflow-hidden flex items-center gap-[30px] p-[32px] p-[34px] rounded-[24px] border border-border bg-gradient-to-b from-[rgba(13,20,36,0.86)] to-[rgba(16,24,46,0.6)] backdrop-blur-[20px] -webkit-backdrop-blur-[20px] shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]">
        <div className="hero-glow absolute inset-[-40%_-10%_auto_auto] w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.2)_0%,transparent_65%)] blur-[30px] pointer-events-none animate-[float1_20s_ease-in-out_infinite_alternate]" />
        <div className="relative z-10 max-w-[620px]">
          <span className="hero-eyebrow inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full border border-brand/22 bg-brand/9 text-[10.5px] font-black tracking-wider uppercase text-sky-300">
            <IconSparkle size={14} />
            Aether Control Panel
          </span>
          <h1 className="mt-[16px] text-[clamp(28px,4vw,44px)] font-black tracking-[-0.035em] leading-[1.15] brand-grad grad-text">
            Welcome back,{firstName ? ` ${firstName}` : ""}.
          </h1>
          <p className="mt-[12px] max-w-[520px] text-[14.5px] text-text-2 leading-[1.65]">
            Spin up game servers, stream their console and manage backups — all from one control surface.
          </p>
          <div className="mt-[22px] flex gap-[10px] flex-wrap">
            <Link to="/servers" className="btn btn-primary">
              <IconServer size={17} className="flex-none" />
              Open servers
            </Link>
            {user?.role === "admin" && (
              <Link to="/admin" className="btn btn-ghost">
                <IconZap size={17} className="flex-none" />
                Provision a server
              </Link>
            )}
          </div>
        </div>
        <div className="hero-orb relative flex-none w-[190px] h-[190px] grid place-items-center mr-[18px] hidden lg:block">
          <span className="hero-orb-ring r1 absolute inset-0 rounded-full border border-brand/28 animate-[spin_14s_linear_infinite]" style={{ borderStyle: "dashed" }} />
          <span className="hero-orb-ring r2 absolute inset-[22px] rounded-full border border-violet/32 animate-[spin_10s_linear_infinite_reverse]" />
          <span className="hero-orb-core w-[62px] h-[62px] rounded-full brand-grad shadow-[0_0_60px_rgba(34,211,238,0.5)] animate-[logo-breathe_4s_ease-in-out_infinite]" />
        </div>
      </section>

      <section className="stat-grid grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[14px]">
        <StatTile icon={<IconServer size={18} className="flex-none" />} label="Total servers" value={stats.total} tone="cyan" />
        <StatTile icon={<IconActivity size={18} className="flex-none" />} label="Online" value={stats.running} tone="green" />
        <StatTile icon={<IconCpu size={18} className="flex-none" />} label="Offline" value={stats.stopped} tone="slate" />
        <StatTile icon={<IconLayers size={18} className="flex-none" />} label="Nodes" value={stats.nodes} tone="violet" />
      </section>

      <section className="dash-section flex flex-col">
        <header className="section-head flex items-flex-end justify-between gap-[16px] mb-[16px]">
          <div>
            <h2 className="section-title text-[19px] font-bold">Your servers</h2>
            <p className="mt-[4px] text-[12.5px] text-text-3">{servers === null ? "Loading fleet…" : `${stats.total} server${stats.total === 1 ? "" : "s"} assigned to you`}</p>
          </div>
          <Link to="/servers" className="section-link inline-flex items-center gap-[4px] text-[12.5px] font-semibold text-text-2 px-[10px] py-[6px] rounded-md border border-border transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-brand hover:border-brand/60 hover:bg-brand/7 hover:gap-[7px]">
            View all
            <IconChevronRight size={15} className="flex-none" />
          </Link>
        </header>

        {!servers ? (
          <div className="page-loading flex flex-col items-center justify-center gap-[14px] min-h-[46vh] text-text-3 text-[13px]">
            <div className="spinner" />
          </div>
        ) : servers.length === 0 ? (
          <div className="card empty-card flex flex-col items-center text-center gap-[10px] p-[52px] p-[24px]">
            <span className="empty-art relative w-[84px] h-[84px] grid place-items-center rounded-[24px] bg-brand/7 border border-brand/22 mb-[6px]">
              <IconServer size={34} className="text-brand" />
              <span className="empty-art-ring absolute inset-[-10px] rounded-[32px] border-[1px] border-dashed border-brand/22 animate-[spin_18s_linear_infinite]" />
            </span>
            <h3 className="text-[19px] font-bold">No servers yet</h3>
            <p className="max-w-[460px] text-text-2 text-[13.5px]">Nothing has been assigned to your account. An admin can provision a game server and attach it to you — or head to the admin console and create one now.</p>
            <div className="empty-actions mt-[8px] flex gap-[10px] flex-wrap justify-center">
              {user?.role === "admin" ? (
                <Link to="/admin?tab=servers" className="btn btn-primary">
                  <IconZap size={17} className="flex-none" />
                  Provision a server
                </Link>
              ) : (
                <Link to="/servers" className="btn btn-ghost">
                  <IconServer size={17} className="flex-none" />
                  Browse servers
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="server-grid grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[18px]">
            {servers.map((s) => <ServerCard server={s} key={s.id} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "cyan" | "green" | "slate" | "violet" }) {
  return (
    <article className={`stat-tile relative overflow-hidden flex items-center gap-[13px] px-[16px] py-[18px] rounded-[18px] border border-border bg-surface backdrop-blur-[16px] -webkit-backdrop-blur-[16px] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group hover:-translate-y-[3px] hover:border-brand/60 hover:shadow-[0_22px_44px_-24px_rgba(0,0,0,0.85)] tone-${tone}`}>
      <span className={`stat-icon flex-none w-[40px] h-[40px] grid place-items-center rounded-[12px] border border-white/10 bg-white/4 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${tone === "cyan" ? "text-sky-300 bg-brand/11 border-brand/26" : tone === "green" ? "text-green-400 bg-green/11 border-green/26" : tone === "slate" ? "text-slate-400 bg-slate/10 border-slate/24" : "text-fuchsia-300 bg-violet/12 border-violet/28"}`}>{icon}</span>
      <div className="stat-body flex flex-col leading-[1.2]">
        <span className="stat-value text-[25px] font-display font-black tracking-[-0.03em]">{value}</span>
        <span className="stat-label mt-[3px] text-[11.5px] font-bold tracking-[0.04em] uppercase text-text-3">{label}</span>
      </div>
      <span className="stat-sheen absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)] translate-x-[-100%] transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none group-hover:translate-x-[100%]" />
    </article>
  );
}
