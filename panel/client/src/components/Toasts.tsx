import React, { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconActivity } from "./Icons";

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

  const pushError = useCallback((err: unknown) => {
    let msg = "Something went wrong";
    if (err instanceof Error) msg = err.message;
    else if (typeof err === "string") msg = err;
    push(msg, "error");
  }, [push]);

  return (
    <ToastContext.Provider value={{ toasts, push, pushError }}>
      {children}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind} flex items-center gap-3 min-w-[270px] max-w-[380px] px-4 py-3 rounded-lg bg-surface-solid border border-white/10 shadow-[0_20px_44px_-18px_rgba(0,0,0,0.9)] text-sm text-white pointer-events-auto animate-[toast-in_380ms_var(--ease)_forwards]`}>
            <span className={`flex-none grid place-items-center w-6 h-6 rounded-lg ${t.kind === "error" ? "text-red-400 bg-red/10" : t.kind === "success" ? "text-green-400 bg-green/10" : "text-sky-300 bg-brand/10"}`}>
              {t.kind === "error" ? <IconAlert size={16} /> : t.kind === "success" ? <IconCheck size={16} /> : <IconActivity size={16} />}
            </span>
            <span className="flex-1">{t.message}</span>
            <span className="absolute left-0 bottom-0 h-[2px] w-full transform-origin-left animate-[toast-bar_4s_linear_forwards] {t.kind === 'error' ? 'bg-red-500' : t.kind === 'success' ? 'bg-green-500' : 'bg-brand-500'}" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
