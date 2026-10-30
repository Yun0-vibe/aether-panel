import { NavLink, useLocation } from "react-router-dom";
import { useAuth, useLogoutAndRedirect } from "../auth/AuthContext";
import { RoleBadge } from "./RoleBadge";
import {
  AetherMark,
  IconClose,
  IconGrid,
  IconLayers,
  IconLogout,
  IconServer,
  IconShield,
} from "./Icons";

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();
  const logout = useLogoutAndRedirect();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const location = useLocation();

  const link = ({ isActive }: { isActive: boolean }) => (isActive ? "side-link active" : "side-link");

  return (
    <aside className={`fixed inset-y-0 left-0 z-60 flex flex-col ${open ? "" : "-translate-x-full"} transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] w-[252px] shadow-[30px_0_60px_-30px_rgba(0,0,0,0.9)] bg-gradient-to-b from-[rgba(8,12,22,0.92)] to-[rgba(8,12,22,0.78)] backdrop-blur-[26px] -webkit-backdrop-blur-[26px] border-r border-border`}
>
      <div className="flex items-center gap-3 px-3 py-1.5 overflow-hidden relative after:absolute after:-right-px after:top-0 after:h-[240px] after:w-[1px] after:bg-gradient-to-b after:from-transparent after:via-brand/55 after:to-transparent">
        <AetherMark size={38} className="filter-drop-shadow-[0_0_14px_rgba(34,211,238,0.45)] animate-[logo-breathe_5s_ease-in-out_infinite] z-10" />
        <div className="flex flex-col leading-[1.1] min-w-0 overflow-hidden z-10">
          <span className="text-[15px] font-black tracking-wider brand-grad grad-text">AETHER</span>
          <span className="mt-[3px] text-[8px] font-bold tracking-widest text-text-3">CONTROL PANEL</span>
        </div>
        <button className="ml-auto flex-none w-7 h-7 grid place-items-center rounded-md border border-transparent text-text-3 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]" onClick={onNavigate} aria-label="Close navigation">
          <IconClose size={18} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto px-0 py-0" aria-label="Primary">
        <span className="px-3 pt-[4px] pb-[7px] text-[9.5px] font-black tracking-widest uppercase text-text-3">Workspace</span>
        <NavLink to="/" end className={link} onClick={onNavigate}>
          <div className="flex items-center gap-3 px-3 py-[9.5px] rounded-lg border border-transparent text-text-2 text-sm font-semibold transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] relative group">
            <IconGrid size={18} className="flex-none opacity-75 group-hover:opacity-100 group-hover:text-brand" />
            <span>Dashboard</span>
          </div>
        </NavLink>
        <NavLink to="/servers" end className={link} onClick={onNavigate}>
          <div className="flex items-center gap-3 px-3 py-[9.5px] rounded-lg border border-transparent text-text-2 text-sm font-semibold transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] relative group">
            <IconServer size={18} className="flex-none opacity-75 group-hover:opacity-100 group-hover:text-brand" />
            <span>Servers</span>
          </div>
        </NavLink>

        {user?.role === "admin" && (
          <>
            <span className="px-3 pt-1 pb-[7px] text-[9.5px] font-black tracking-widest uppercase text-text-3">Administration</span>
            <NavLink to="/admin" className={link} onClick={onNavigate}>
              <div className="flex items-center gap-3 px-3 py-[9.5px] rounded-lg border border-transparent text-text-2 text-sm font-semibold transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] relative group">
                <IconShield size={18} className="flex-none opacity-75 group-hover:opacity-100 group-hover:text-brand" />
                <span>Admin console</span>
              </div>
            </NavLink>
            <NavLink to="/admin?tab=nodes" className={link} onClick={onNavigate}>
              <div className="flex items-center gap-3 px-3 py-[9.5px] rounded-lg border border-transparent text-text-2 text-sm font-semibold transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] relative group">
                <IconLayers size={18} className="flex-none opacity-75 group-hover:opacity-100 group-hover:text-brand" />
                <span>Nodes</span>
              </div>
            </NavLink>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2 px-3 py-0.5 border-t border-border mt-3 relative z-10">
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className="avatar">{initials}</span>
          <div className="min-w-0 flex flex-col gap-1 items-start">
            <span className="trunc text-[12px] font-semibold text-text-2" title={user?.email}>{user?.email}</span>
            <RoleBadge role={user?.role ?? "user"} />
          </div>
        </div>
        <button className="flex-none w-7 h-7 grid place-items-center rounded-lg border border-transparent text-text-3 hover:text-red-500 hover:bg-red/10 hover:border-red/30 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]" onClick={() => void logout()} title="Log out" aria-label="Log out">
          <IconLogout size={18} />
        </button>
      </div>
    </aside>
  );
}
