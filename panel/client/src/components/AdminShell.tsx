import { useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth, useLogoutAndRedirect } from "../auth/AuthContext";
import { RoleBadge } from "./RoleBadge";
import {
  AetherMark,
  IconGrid,
  IconLayers,
  IconLogout,
  IconServer,
  IconUsers,
} from "./Icons";

const META: Record<string, { title: string; sub: string }> = {
  "/admin": { title: "Admin overview", sub: "Health of the whole panel" },
  "/admin/users": { title: "Users", sub: "Accounts, roles and access" },
  "/admin/nodes": { title: "Nodes", sub: "Machines running your daemons" },
  "/admin/servers": { title: "Servers", sub: "Every provisioned game server" },
};

export function AdminShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { user } = useAuth();
  const logout = useLogoutAndRedirect();
  const location = useLocation();
  const meta = META[location.pathname] ?? { title: "Administration", sub: "Aether admin portal" };
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
      isActive
        ? "border-[rgba(168,85,247,0.42)] bg-[rgba(168,85,247,0.13)] text-white shadow-[0_8px_20px_-12px_rgba(168,85,247,0.5)]"
        : "border-transparent text-text-2 hover:border-white/10 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="relative min-h-screen">
      <div className="app-bg z-[-1]">
        <span className="app-orb orb-1" />
        <span className="app-orb orb-2" />
        <span className="app-orb orb-3" />
        <span className="app-grid-lines" />
      </div>

      {/* Admin-only sidebar (violet identity, separate from client area) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-[rgba(168,85,247,0.22)] bg-gradient-to-b from-[rgba(13,9,28,0.96)] to-[rgba(13,9,28,0.84)] backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <AetherMark size={36} className="flex-none drop-shadow-[0_0_14px_rgba(168,85,247,0.5)]" />
          <div className="flex min-w-0 flex-col leading-[1.1]">
            <span className="bg-gradient-to-r from-[#a855f7] via-[#8b5cf6] to-[#6366f1] bg-clip-text text-[15px] font-black tracking-wider text-transparent">
              AETHER ADMIN
            </span>
            <span className="mt-[3px] text-[8px] font-bold tracking-[0.24em] text-fuchsia-300/70">
              PORTAL
            </span>
          </div>
          <button
            className="ml-auto flex h-8 w-8 flex-none place-items-center rounded-lg text-text-3 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close admin navigation"
          >
            <IconUsers size={0} className="hidden" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 pt-2" aria-label="Admin">
          <span className="mb-1 px-2 text-[9.5px] font-black uppercase tracking-[0.16em] text-fuchsia-300/60">
            Administration
          </span>
          <NavLink to="/admin" end className={linkCls} onClick={() => setNavOpen(false)}>
            <IconGrid size={18} className="flex-none opacity-80" />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/admin/users" className={linkCls} onClick={() => setNavOpen(false)}>
            <IconUsers size={18} className="flex-none opacity-80" />
            <span>Users</span>
          </NavLink>
          <NavLink to="/admin/nodes" className={linkCls} onClick={() => setNavOpen(false)}>
            <IconLayers size={18} className="flex-none opacity-80" />
            <span>Nodes</span>
          </NavLink>
          <NavLink to="/admin/servers" className={linkCls} onClick={() => setNavOpen(false)}>
            <IconServer size={18} className="flex-none opacity-80" />
            <span>Servers</span>
          </NavLink>

          <span className="mb-1 mt-4 px-2 text-[9.5px] font-black uppercase tracking-[0.16em] text-fuchsia-300/60">
            Client area
          </span>
          <Link to="/" className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[13px] font-semibold text-text-2 transition-all duration-200 hover:border-white/10 hover:bg-white/5 hover:text-white" onClick={() => setNavOpen(false)}>
            <IconLogout size={18} className="flex-none rotate-180 opacity-80" />
            <span>Back to panel</span>
          </Link>
        </nav>

        <div className="border-t border-white/6 p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-white/4 px-3 py-2.5">
            <span className="avatar !h-9 !w-9">{initials}</span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
              <span className="trunc max-w-full text-[12px] font-semibold text-white" title={user?.email}>
                {user?.email}
              </span>
              <RoleBadge role={user?.role ?? "user"} />
            </div>
            <button
              className="flex h-8 w-8 flex-none place-items-center rounded-lg text-text-3 transition-colors hover:bg-[rgba(248,113,113,0.12)] hover:text-[#fca5a5]"
              onClick={() => void logout()}
              title="Log out"
              aria-label="Log out"
            >
              <IconLogout size={17} />
            </button>
          </div>
        </div>
      </aside>

      <button
        className={`fixed inset-0 z-30 border-none bg-[#03060e]/60 backdrop-blur-[3px] lg:hidden ${
          navOpen ? "block animate-[fade-in_200ms_var(--ease)]" : "hidden"
        }`}
        onClick={() => setNavOpen(false)}
        aria-label="Close admin navigation"
        tabIndex={navOpen ? 0 : -1}
      />

      <div className="flex min-h-screen flex-col lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-[64px] items-center gap-5 border-b border-border bg-[rgba(7,5,15,0.72)] px-[30px] backdrop-blur-xl">
          <button
            className="flex h-7 w-7 flex-none flex-col justify-center gap-[4px] rounded-lg border border-white/4 bg-white/4 px-2 transition-colors hover:border-fuchsia-400/60 hover:text-fuchsia-300 lg:hidden"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Toggle admin navigation"
            aria-expanded={navOpen}
          >
            <span className="h-[1px] w-[22px] rounded-full bg-text-2" />
            <span className="h-[1px] w-[22px] rounded-full bg-text-2" />
            <span className="h-[1px] w-[22px] rounded-full bg-text-2" />
          </button>
          <div className="flex min-w-0 flex-col leading-[1.2]">
            <span className="text-[14px] font-bold">{meta.title}</span>
            <span className="mt-[1px] trunc text-[11px] text-text-3">{meta.sub}</span>
          </div>
          <div className="ml-auto flex items-center gap-[10px]">
            <span className="hidden items-center gap-[7px] rounded-full border border-fuchsia-400/24 bg-fuchsia-400/10 px-3 py-[6px] text-[11.5px] font-semibold text-fuchsia-300 md:flex">
              Admin portal
            </span>
            <Link
              to="/"
              className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-border bg-white/4 px-3 text-[12.5px] font-semibold text-text-2 transition-all duration-150 hover:border-brand/60 hover:bg-brand/8 hover:text-white"
            >
              Client area
            </Link>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
