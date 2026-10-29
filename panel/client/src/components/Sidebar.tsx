import { Link, NavLink } from "react-router-dom";
import { useAuth, useLogoutAndRedirect } from "../auth/AuthContext";
import { RoleBadge } from "./NavBar"; // reuse RoleBadge

export function Sidebar() {
  const { user } = useAuth();
  const logout = useLogoutAndRedirect();
  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="brand">
          <img src="/favicon-192.png" alt="Aether Panel" className="logo" />
        </Link>
        <button className="btn btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </div>
      <nav className="nav-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Dashboard</NavLink>
        {user?.role === "admin" && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>Admin</NavLink>
        )}
      </nav>
      <div className="sidebar-user">
        {user?.email && <span className="user-email">{user.email}</span>}
        {user?.role && <RoleBadge role={user.role} />}
      </div>
    </aside>
  );
}