import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { User } from "../auth/AuthContext";
import { AetherMark, IconActivity, IconLock, IconMail, IconServer, IconShield } from "../components/Icons";

interface AuthResponse { user: User; }

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const data = await api<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } });
      setUser(data.user);
      navigate(from, { replace: true });
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Login failed"); } finally { setBusy(false); }
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Control your game fleet." sub="Sign in to manage servers, streams and backups from a single console.">
      <form onSubmit={submit} className="auth-form flex flex-col gap-[15px]">
        <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Email address</span><div className="field-input-wrap relative flex items-center"><IconMail size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" /></div></label>
        <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Password</span><div className="field-input-wrap relative flex items-center"><IconLock size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" /></div></label>
        {err && <div className="inline-alert flex items-center gap-[8px] px-[13px] py-[10px] rounded-lg text-red-400 bg-red/10 border border-red/30 text-[12.5px]"><IconShield size={15} className="flex-none" />{err}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{busy ? "Signing in…" : "Sign in to Aether"}</button>
      </form>
      <p className="auth-alt text-[13px] text-text-3 text-center"><span>No account? </span><Link to="/register" className="text-brand font-bold hover:text-sky-300 hover:underline hover:text-underline-offset-[3px] transition-colors duration-150">Create one</Link></p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (password !== confirm) { setErr("Passwords do not match"); return; }
    setBusy(true);
    try {
      const data = await api<AuthResponse>("/api/auth/register", { method: "POST", body: { email, password } });
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Registration failed"); } finally { setBusy(false); }
  }

  return (
    <AuthShell eyebrow="Get started" title="Join the fleet." sub="Create your operator account and take control of your game servers.">
      <form onSubmit={submit} className="auth-form flex flex-col gap-[15px]">
        <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Email address</span><div className="field-input-wrap relative flex items-center"><IconMail size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" /></div></label>
        <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Password</span><div className="field-input-wrap relative flex items-center"><IconLock size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" /></div></label>
        <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Confirm password</span><div className="field-input-wrap relative flex items-center"><IconLock size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" /></div></label>
        {err && <div className="inline-alert flex items-center gap-[8px] px-[13px] py-[10px] rounded-lg text-red-400 bg-red/10 border border-red/30 text-[12.5px]"><IconShield size={15} className="flex-none" />{err}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{busy ? "Creating account…" : "Create account"}</button>
        <p className="auth-note text-[11.5px] text-text-3 text-center">The first account created becomes the panel administrator.</p>
      </form>
      <p className="auth-alt text-[13px] text-text-3 text-center"><span>Already registered? </span><Link to="/login" className="text-brand font-bold hover:text-sky-300 hover:underline hover:text-underline-offset-[3px] transition-colors duration-150">Sign in</Link></p>
    </AuthShell>
  );
}

function AuthShell({ children, eyebrow, title, sub }: { children: React.ReactNode; eyebrow: string; title: string; sub: string }) {
  return (
    <div className="auth-wrap relative min-h-screen overflow-hidden grid grid-cols-[1.05fr_0.95fr]">
      <div className="auth-aurora absolute inset-0 pointer-events-none">
        <span className="blob blob-a absolute rounded-full blur-[110px] w-[560px] h-[560px] top-[-160px] left-[-100px] bg-[radial-gradient(circle,rgba(34,211,238,0.32)_0%,transparent_68%)] animate-[float1_20s_ease-in-out_infinite_alternate]" />
        <span className="blob blob-b absolute rounded-full blur-[110px] w-[520px] h-[520px] bottom-[-180px] left-[30%] bg-[radial-gradient(circle,rgba(168,85,247,0.28)_0%,transparent_68%)] animate-[float2_26s_ease-in-out_infinite_alternate]" />
        <span className="blob blob-c absolute rounded-full blur-[110px] w-[420px] h-[420px] top-[30%] right-[-120px] bg-[radial-gradient(circle,rgba(59,130,246,0.26)_0%,transparent_70%)] animate-[float3_30s_ease-in-out_infinite_alternate]" />
      </div>

      <section className="auth-brand relative z-1 flex flex-col justify-between gap-[34px] p-[52px] p-[56px] border-r border-border bg-gradient-to-b from-[rgba(8,12,22,0.72)] to-[rgba(10,15,29,0.42)] backdrop-blur-[6px] -webkit-backdrop-blur-[6px]">
        <div>
          <Link to="/" className="auth-brand-lockup inline-flex items-center gap-[13px] w-fit"><AetherMark size={44} className="filter-drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]" /><span className="auth-brand-words flex flex-col leading-[1.1]"><span className="auth-brand-name font-display text-[18px] font-bold tracking-[0.2em] brand-grad grad-text">AETHER</span><span className="auth-brand-sub mt-[4px] text-[9px] font-bold tracking-[0.3em] text-text-3">CONTROL PANEL</span></span></Link>
          <div className="auth-brand-copy mt-[18px] max-w-[520px]">
            <span className="hero-eyebrow inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full border border-brand/22 bg-brand/9 text-[10.5px] font-black tracking-wider uppercase text-sky-300">Game server orchestration</span>
            <h2 className="auth-tagline mt-[16px] text-[clamp(32px,4.4vw,54px)] font-black tracking-[-0.04em] leading-[1.05] brand-grad grad-text">{title}</h2>
            <p className="auth-sub mt-[16px] max-w-[460px] text-[15px] text-text-2 leading-[1.7]">{sub}</p>
          </div>
          <ul className="auth-features flex flex-col gap-[11px]">
            <li className="flex items-center gap-[12px] text-[13.5px] font-medium text-text-2"><span className="auth-feature-icon flex-none w-[32px] h-[32px] grid place-items-center rounded-[10px] text-brand bg-brand/9 border border-brand/22"><IconActivity size={16} className="flex-none" /></span>Live console streaming with full power control</li>
            <li className="flex items-center gap-[12px] text-[13.5px] font-medium text-text-2"><span className="auth-feature-icon flex-none w-[32px] h-[32px] grid place-items-center rounded-[10px] text-brand bg-brand/9 border border-brand/22"><IconServer size={16} className="flex-none" /></span>Multi-node provisioning with isolated containers</li>
            <li className="flex items-center gap-[12px] text-[13.5px] font-medium text-text-2"><span className="auth-feature-icon flex-none w-[32px] h-[32px] grid place-items-center rounded-[10px] text-brand bg-brand/9 border border-brand/22"><IconShield size={16} className="flex-none" /></span>Role-based access, file manager and one-click backups</li>
          </ul>
          <div className="auth-brand-foot flex gap-[34px] pt-[26px] border-t border-border">
            <span className="auth-stat flex flex-col gap-[3px]"><strong className="font-display text-[21px] font-bold text-white">99.9%</strong><span className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-text-3">uptime target</span></span>
            <span className="auth-stat flex flex-col gap-[3px]"><strong className="font-display text-[21px] font-bold text-white">&lt;50ms</strong><span className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-text-3">console latency</span></span>
            <span className="auth-stat flex flex-col gap-[3px]"><strong className="font-display text-[21px] font-bold text-white">24/7</strong><span className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-text-3">autonomous ops</span></span>
          </div>
        </div>
      </section>

      <section className="auth-panel relative z-1 flex flex-col items-center justify-center gap-[20px] p-[42px] p-[34px]">
        <div className="auth-card w-full max-w-[408px] p-[32px] rounded-[24px] bg-[rgba(13,19,34,0.72)] backdrop-blur-[26px] -webkit-backdrop-blur-[26px] border border-white/12 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.95)] animate-[fade-up_560ms_var(--ease)_both]">
          <span className="auth-eyebrow block mb-[20px] text-[10.5px] font-bold tracking-[0.2em] uppercase text-brand">{eyebrow}</span>
          {children}
        </div>
        <p className="auth-legal text-[11px] text-text-3 tracking-[0.04em]">Aether Panel — self-hosted game server control panel</p>
      </section>
    </div>
  );
}
