import React, { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type ToastKind = "error" | "success" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind) => void;
  pushError: (err: unknown) => void;
}

const ToastContext = createContext<ToastState>({
  toasts: [],
  push: () => {},
  pushError: () => {},
});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const pushError = useCallback(
    (err: unknown) => {
      let msg = "Something went wrong";
      if (err instanceof Error) msg = err.message;
      else if (typeof err === "string") msg = err;
      push(msg, "error");
    },
    [push]
  );

  return (
    <ToastContext.Provider value={{ toasts, push, pushError }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
