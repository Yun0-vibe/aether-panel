import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { User } from "../auth/AuthContext";
import { AetherMark, IconActivity, IconLock, IconMail, IconServer, IconShield } from "../components/Icons";
import { useBranding } from "../brand/BrandContext";

interface AuthResponse { user: User; }

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  // Authenticator-code sign-in: email + 6-digit code, no password needed.
  const [codeMode, setCodeMode] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  useEffect(() => {
    api<{ enabled?: boolean }>("/api/auth/discord/status").then((d) => setDiscordEnabled(Boolean(d.enabled))).catch(() => {});
    // Surface the OAuth callback result (?discord=notlinked etc.)
    const q = new URLSearchParams(window.location.search);
    const d = q.get("discord");
    if (d) window.history.replaceState({}, "", "/login");
    setErr(
      d === "notlinked" ? "That Discord account is not linked to a panel account yet — sign in with your password, then link it in Profile → Security."
      : d === "expired" ? "Discord sign-in expired — try again."
      : d === "token" || d === "profile" || d === "error" ? "Discord sign-in failed — try again."
      : d === "taken" ? "That Discord account is already linked to another panel user."
      : d === "unconfigured" ? "Discord OAuth is not configured on this server."
      : null,
    );
  }, []);

  async function submit(e: React.FormEvent, codeOnly = false) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const body: Record<string, unknown> = codeOnly ? { email, totp } : { email, password };
      if (mfaToken) { body.mfaToken = mfaToken; body.totp = totp; }
      const data = await api<AuthResponse>("/api/auth/login", { method: "POST", body, noRedirect: true });
      setUser(data.user);
      navigate(from, { replace: true });
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { totpRequired?: boolean; mfaToken?: string } | null) : null;
      if (e instanceof ApiError && e.status === 401 && body?.totpRequired) {
        setMfaToken(body.mfaToken ?? null);
        setErr("Enter the 6-digit code from your authenticator app");
      } else {
        setErr(
          e instanceof ApiError
            ? codeOnly && e.message === "invalid credentials" ? "Wrong email or authenticator code" : e.message === "invalid credentials" ? "Wrong email or password" : e.message
            : e instanceof Error ? e.message : "Login failed",
        );
      }
    } finally { setBusy(false); }
  }

  async function passkeySign() {
    setErr(null); setBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { options } = await api<{ options: Record<string, unknown> }>("/api/auth/passkey/options", { method: "POST", noRedirect: true });
      const attResp = await startAuthentication({ optionsJSON: options as never });
      const data = await api<AuthResponse>("/api/auth/passkey/login", { method: "POST", body: { response: attResp }, noRedirect: true });
      setUser(data.user);
      navigate(from, { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Passkey sign-in failed");
    } finally { setBusy(false); }
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Control your game fleet." sub="Sign in to manage servers, streams and backups from a single console.">
      <form onSubmit={(e) => void submit(e, codeMode && !mfaToken)} className="auth-form flex flex-col gap-[15px]">
        {(mfaToken || codeMode) && (
          <label className="field flex flex-col gap-[7px]">
            <span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Email address</span>
            <div className="field-input-wrap relative flex items-center">
              <IconMail size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" />
              <input type="email" required autoFocus={!mfaToken} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" />
            </div>
          </label>
        )}
        {mfaToken && (
          <label className="field flex flex-col gap-[7px]">
            <span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Authenticator code</span>
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              placeholder="123 456"
              className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[15px] tracking-[0.35em] text-center outline-none focus:border-brand/60 focus:bg-brand/5 transition-all duration-150"
            />
          </label>
        )}
        {!mfaToken && !codeMode && (
          <>
            <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Email address</span><div className="field-input-wrap relative flex items-center"><IconMail size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" /></div></label>
            <label className="field flex flex-col gap-[7px]"><span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">Password</span><div className="field-input-wrap relative flex items-center"><IconLock size={16} className="field-icon absolute left-[12px] text-text-3 pointer-events-none" /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="field-input w-full h-[40px] pl-[36px] pr-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[13.5px] outline-none focus:border-brand/60 focus:bg-brand/5 focus-visible:ring-3 focus-visible:ring-brand/20 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" /></div></label>
          </>
        )}
        {!mfaToken && codeMode && (
          <label className="field flex flex-col gap-[7px]">
            <span className="field-label text-[11px] font-bold tracking-wider uppercase text-text-3">6-digit authenticator code</span>
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123 456"
              className="field-input w-full h-[40px] px-[13px] rounded-lg bg-[#000]/26 border border-border text-white text-[15px] tracking-[0.35em] text-center outline-none focus:border-brand/60 focus:bg-brand/5 transition-all duration-150"
            />
          </label>
        )}
        {err && <div className="inline-alert flex items-center gap-[8px] px-[13px] py-[10px] rounded-lg text-red-400 bg-red/10 border border-red/30 text-[12.5px]"><IconShield size={15} className="flex-none" />{err}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="btn-spinner" /> : null}{busy ? "Signing in…" : mfaToken ? "Verify & sign in" : codeMode ? "Sign in with code" : "Sign in"}</button>
      </form>
      {codeMode && !mfaToken && (
        <button type="button" className="btn btn-ghost btn-block gap-[10px]" onClick={() => { setCodeMode(false); setTotp(""); setErr(null); }}>
          Use password instead
        </button>
      )}

      {!mfaToken && !codeMode && (
        <div className="flex flex-col gap-[9px]">
          <div className="flex items-center gap-[10px] text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-block gap-[10px]"
            onClick={() => void passkeySign()}
            disabled={busy}
          >
            <Fingerprint size={17} className="flex-none" />
            Sign in with a passkey
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block gap-[10px]"
            onClick={() => { setCodeMode(true); setTotp(""); setErr(null); }}
            disabled={busy}
          >
            <ShieldCheck size={17} className="flex-none" />
            Sign in with authenticator code
          </button>
          {discordEnabled && (
            <a href="/api/auth/discord" className="btn btn-block gap-[10px] !bg-[#5865F2] !text-white !border-[#5865F2] hover:!bg-[#4752C4] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-none"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/></svg>
              Sign in with Discord
            </a>
          )}
        </div>
      )}
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
  const { branding } = useBranding();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <span className="absolute rounded-full blur-[130px] w-[620px] h-[620px] top-[-220px] left-[8%] bg-[radial-gradient(circle,rgba(34,211,238,0.17)_0%,transparent_70%)]" />
        <span className="absolute rounded-full blur-[130px] w-[520px] h-[520px] bottom-[-200px] right-[4%] bg-[radial-gradient(circle,rgba(168,85,247,0.15)_0%,transparent_70%)]" />
        <span className="absolute inset-0 bg-[linear-gradient(rgba(120,165,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(120,165,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_75%)]" />
      </div>

      <div className="relative z-1 flex w-full max-w-[420px] flex-col items-center">
        {/* brand header */}
        <div className="mb-[26px] flex flex-col items-center gap-[12px] text-center">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-[56px] w-[56px] rounded-[16px] object-contain shadow-[0_10px_40px_-10px_rgba(34,211,238,0.55)]" />
          ) : (
            <AetherMark size={56} className="drop-shadow-[0_0_22px_rgba(34,211,238,0.5)]" />
          )}
          <div className="flex flex-col items-center leading-[1.1]">
            <span className="text-[17px] font-black tracking-[0.14em] brand-grad grad-text">{branding.panelName.toUpperCase()}</span>
            <span className="mt-[5px] text-[8.5px] font-bold tracking-[0.3em] text-text-3">
              {branding.tagline ? branding.tagline.toUpperCase() : "CONTROL PANEL"}
            </span>
          </div>
        </div>

        {/* card */}
        <div className="w-full rounded-[22px] border border-white/10 bg-[rgba(11,16,29,0.82)] p-[26px] backdrop-blur-[24px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] animate-[fade-up_520ms_var(--ease)_both] sm:p-[30px]">
          <div className="mb-[20px] text-center">
            <h1 className="text-[19px] font-bold text-white">{title}</h1>
            <p className="mt-[6px] text-[12.5px] leading-[1.55] text-text-2">{sub}</p>
          </div>
          {children}
        </div>

        <p className="mt-[22px] text-center text-[10.5px] tracking-[0.04em] text-text-3">
          © {new Date().getFullYear()} {branding.panelName} · {eyebrow}
        </p>
      </div>
    </div>
  );
}
