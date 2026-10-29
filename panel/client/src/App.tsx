import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAdmin, RequireAuth } from "./auth/Guards";
import { ToastProvider } from "./components/Toasts";
import { NavBar } from "./components/NavBar";
import { Sidebar } from "./components/Sidebar";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { Dashboard } from "./pages/Dashboard";
import { ServerDetail } from "./pages/ServerDetail";
import { AdminPage } from "./pages/Admin";

export default function App() {
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
  return (
    <div className="app shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}
