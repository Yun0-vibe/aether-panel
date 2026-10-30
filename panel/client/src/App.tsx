import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAdmin, RequireAuth } from "./auth/Guards";
import { ToastProvider } from "./components/Toasts";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { Dashboard } from "./pages/Dashboard";
import { ServersPage } from "./pages/Servers";
import { ServerDetail } from "./pages/ServerDetail";
import { AdminPage } from "./pages/Admin";

export default function App() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Shell>
                    <Dashboard />
                  </Shell>
                </RequireAuth>
              }
            />
            <Route
              path="/servers"
              element={
                <RequireAuth>
                  <Shell>
                    <ServersPage />
                  </Shell>
                </RequireAuth>
              }
            />
            <Route
              path="/servers/:id"
              element={
                <RequireAuth>
                  <Shell>
                    <ServerDetail />
                  </Shell>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <Shell>
                    <AdminPage />
                  </Shell>
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className={`relative min-h-screen isolation-isolate ${navOpen ? "nav-open" : ""}`}>
      <div className="app-bg z-[-1]">
        <span className="app-orb orb-1" />
        <span className="app-orb orb-2" />
        <span className="app-orb orb-3" />
        <span className="app-grid-lines" />
      </div>
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      <button className="nav-scrim" onClick={() => setNavOpen(false)} aria-label="Close navigation" tabIndex={navOpen ? 0 : -1} />
      <div className="flex-1 min-w-[0] flex flex-col main-margin">
        <TopBar onToggleNav={() => setNavOpen((v) => !v)} navOpen={navOpen} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
