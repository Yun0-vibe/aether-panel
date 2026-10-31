import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAdmin, RequireAuth } from "./auth/Guards";
import { ToastProvider } from "./components/Toasts";
import { AdminShell } from "./components/AdminShell";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { ProfilePage } from "./pages/ProfilePage";
import { Dashboard } from "./pages/Dashboard";
import { ServersPage } from "./pages/Servers";
import { ServerDetail } from "./pages/ServerDetail";
import { ServerWizard } from "./pages/ServerWizard";
import { AdminOverview, BrandingTab, EggsTab, NodesTab, ServersTab, UsersTab } from "./pages/Admin";
import { BrandProvider } from "./brand/BrandContext";

export default function App() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        <BrandProvider>
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
              path="/profile"
              element={
                <RequireAuth>
                  <Shell>
                    <ProfilePage />
                  </Shell>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminShell>
                    <AdminOverview />
                  </AdminShell>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAdmin>
                  <AdminShell>
                    <UsersTab />
                  </AdminShell>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/nodes"
              element={
                <RequireAdmin>
                  <AdminShell>
                    <NodesTab />
                  </AdminShell>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/eggs"
              element={
                <RequireAdmin>
                  <AdminShell>
                    <EggsTab />
                  </AdminShell>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/branding"
              element={
                <RequireAdmin>
                  <AdminShell>
                    <BrandingTab />
                  </AdminShell>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/servers/new"
              element={
                <RequireAdmin>
                  <AdminShell>
                    <ServerWizard />
                  </AdminShell>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/servers"
              element={
                <RequireAdmin>
                  <AdminShell>
                    <ServersTab />
                  </AdminShell>
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ToastProvider>
        </BrandProvider>
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
      <button
        className={`fixed inset-0 z-30 border-none bg-[#03060e]/60 backdrop-blur-[3px] lg:hidden ${
          navOpen ? "block animate-[fade-in_200ms_var(--ease)]" : "hidden"
        }`}
        onClick={() => setNavOpen(false)}
        aria-label="Close navigation"
        tabIndex={navOpen ? 0 : -1}
      />
      <div className="flex-1 min-w-[0] flex flex-col main-margin">
        <TopBar onToggleNav={() => setNavOpen((v) => !v)} navOpen={navOpen} />
        <main className="main-content">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
