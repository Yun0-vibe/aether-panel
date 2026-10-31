import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../auth/AuthContext";

export interface Branding {
  panelName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
}

interface BrandApi {
  branding: Branding;
  reload: () => Promise<void>;
  save: (patch: Partial<Record<keyof Branding, string>>) => Promise<void>;
}

const Ctx = createContext<BrandApi | null>(null);

const FALLBACK: Branding = {
  panelName: "Aether Panel",
  tagline: "Game servers, handled.",
  logoUrl: "",
  faviconUrl: "",
};

function setFavicon(url: string, name: string) {
  const href = url || "/favicon.svg";
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
  }
  document.title = `${name} — ${FALLBACK.tagline}`;
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(FALLBACK);

  const apply = useCallback((b: Branding) => {
    setBranding(b);
    setFavicon(b.faviconUrl, b.panelName);
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await api<{ branding?: Branding }>("/api/branding");
      apply({ ...FALLBACK, ...(d.branding ?? {}) });
    } catch {
      /* keep fallback */
    }
  }, [apply]);

  const save = useCallback(
    async (patch: Partial<Record<keyof Branding, string>>) => {
      const d = await api<{ branding?: Branding }>("/api/admin/branding", { method: "PATCH", body: patch });
      apply({ ...FALLBACK, ...(d.branding ?? {}) });
    },
    [apply],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ branding, reload, save }}>{children}</Ctx.Provider>;
}

export function useBranding(): BrandApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBranding must be used inside <BrandProvider>");
  return ctx;
}
