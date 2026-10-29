import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, useAuth } from "../auth/AuthContext";
import type { User } from "../auth/AuthContext";

interface AuthResponse {
  user: User;
}

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
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const data = await api<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } });
      setUser(data.user);
      navigate(from, { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1>Welcome back</h1>
      <p className="auth-sub">Sign in to manage your servers</p>
      <form onSubmit={submit} className="auth-form">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        {err && <div className="inline-alert">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <span className="btn-spinner" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-alt">
        No account? <Link to="/register">Create one</Link>
      </p>
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
    e.preventDefault();
    setErr(null);
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const data = await api<AuthResponse>("/api/auth/register", { method: "POST", body: { email, password } });
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1>Create account</h1>
      <p className="auth-sub">A game server control panel</p>
      <form onSubmit={submit} className="auth-form">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
          />
        </label>
        {err && <div className="inline-alert">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <span className="btn-spinner" /> : null}
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="auth-note">First account becomes admin</p>
      </form>
      <p className="auth-alt">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-left">
        <div className="brand brand-large">
          <span className="brand-mark">▲</span> Aether
        </div>
        <h2 className="auth-tagline">Game server management, without the chaos.</h2>
        <ul className="auth-features">
          <li>⚡ One-click power actions & live console</li>
          <li>🖥️ Multi-node Docker orchestration</li>
          <li>🧩 Role-based access for admins & users</li>
        </ul>
      </div>
      <div className="auth-right">
        <div className="card auth-card">{children}</div>
      </div>
    </div>
  );
}
