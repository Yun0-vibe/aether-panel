import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth, useLogoutAndRedirect } from "../auth/AuthContext";

function RoleBadge({ role }: { role: string }) {
  return <span className={`role-badge role-${role}`}>{role}</span>;
}

export function NavBar() {
  const { user } = useAuth();
  const logout = useLogoutAndRedirect();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">▲</span> Aether Panel
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Dashboard
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="nav-user">
          <span className="nav-email">{user?.email}</span>
          <RoleBadge role={user?.role ?? "user"} />
          <button className="btn btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
