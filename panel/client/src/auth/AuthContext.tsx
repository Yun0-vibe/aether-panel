import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  role: string;
  displayName?: string;
  bio?: string;
  discordId?: string | null;
  createdAt?: number;
}

interface AuthState {
  user: User | null;
  setUser: (u: User | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  setUser: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUser(data.user ?? null);
        }
      } catch {
        /* ignore network errors on boot */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Convenience hook: true when the session user has admin role. */
export function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === "admin";
}

/**
 * Small helper for JSON API calls.
 * Throws ApiError on non-2xx responses.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as Record<string, unknown>).error)
        : `Request failed (${status})`;
    super(msg);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new ApiError(401, { error: "Session expired" });
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}

/** Live status polled from the server list — used for status badges. */
export interface ServerSummary {
  id: string;
  name: string;
  image: string;
  port: number | null;
  status: string | null;
  userId: string;
  nodeId: string;
  node?: { name: string; host: string } | null;
}

export function useLogoutAndRedirect() {
  const { setUser } = useAuth();
  return useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { credentials: "include", method: "POST" });
    } catch {
      /* ignore */
    }
    setUser(null);
    window.location.href = "/login";
  }, [setUser]);
}

export default AuthContext;
