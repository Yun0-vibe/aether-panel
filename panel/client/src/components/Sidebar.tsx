import { NavLink } from "react-router-dom";
import { useAuth, useLogoutAndRedirect } from "../auth/AuthContext";
import { RoleBadge } from "./RoleBadge";
import {
  AetherMark,
  IconClose,
  IconGrid,
  IconLogout,
  IconServer,
  IconShield,
  IconUsers,
} from "./Icons";

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();
  const logout = useLogoutAndRedirect();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
      isActive
        ? "border-brand/35 bg-brand/12 text-white shadow-[0_8px_20px_-12px_rgba(34,211,238,0.45)]"
        : "border-transparent text-text-2 hover:border-white/10 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-border bg-gradient-to-b from-[rgba(8,12,22,0.94)] to-[rgba(8,12,22,0.80)] backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        open ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4">
        <AetherMark size={36} className="flex-none drop-shadow-[0_0_14px_rgba(34,211,238,0.45)]" />
        <div className="flex min-w-0 flex-col leading-[1.1]">
          <span className="bg-gradient-to-r from-[#22d3ee] via-[#3b82f6] to-[#a855f7] bg-clip-text text-[15px] font-black tracking-wider text-transparent">
            AETHER
          </span>
          <span className="mt-[3px] text-[8px] font-bold tracking-[0.24em] text-text-3">
            CONTROL PANEL
          </span>
        </div>
        <button
          className="ml-auto flex h-8 w-8 flex-none place-items-center rounded-lg text-text-3 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          onClick={onNavigate}
          aria-label="Close navigation"
        >
          <IconClose size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 pt-2" aria-label="Primary">
        <span className="mb-1 px-2 text-[9.5px] font-black uppercase tracking-[0.16em] text-text-3">
          Overview
        </span>
        <NavLink to="/" end className={linkCls} onClick={onNavigate}>
          <IconGrid size={18} className="flex-none opacity-80" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/servers" className={linkCls} onClick={onNavigate}>
          <IconServer size={18} className="flex-none opacity-80" />
          <span>Servers</span>
        </NavLink>

        <span className="mb-1 mt-4 px-2 text-[9.5px] font-black uppercase tracking-[0.16em] text-text-3">
          Account
        </span>
        <NavLink to="/profile" className={linkCls} onClick={onNavigate}>
          <IconUsers size={18} className="flex-none opacity-80" />
          <span>Profile</span>
        </NavLink>

        {user?.role === "admin" && (
          <>
            <span className="mb-1 mt-4 px-2 text-[9.5px] font-black uppercase tracking-[0.16em] text-text-3">
              Administration
            </span>
            <NavLink to="/admin" className={linkCls} onClick={onNavigate}>
              <IconShield size={18} className="flex-none opacity-80" />
              <span>Admin portal</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* User footer card */}
      <div className="border-t border-border p-3">
        <div
          className="flex items-center gap-2.5 rounded-xl border border-border bg-white/4 px-3 py-2.5"
          style={{ isolation: "isolate" }}
        >
          <span className="avatar !h-9 !w-9">{initials}</span>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
            <span className="trunc max-w-full text-[12px] font-semibold text-white" title={user?.email}>
              {user?.email}
            </span>
            <RoleBadge role={(user?.role ?? "user").toLowerCase()} />
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
  );
}
