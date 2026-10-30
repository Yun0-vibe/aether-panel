import React from "react";
import { IconClose, IconAlert } from "./Icons";

export interface ConfirmRequest {
  title: string;
  message: React.ReactNode;
  warning?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmModal({ req, busy, onClose }: { req: ConfirmRequest | null; busy: boolean; onClose: () => void }) {
  if (!req) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#03060e]/72 backdrop-blur-[10px] -webkit-backdrop-blur-[10px] animate-[fade-in_220ms_var(--ease)]" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-[460px] rounded-[24px] bg-gradient-to-b from-[rgba(18,25,43,0.97)] to-[rgba(12,17,31,0.97)] border border-white/12 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] animate-[modal-in_320ms_var(--ease)] overflow-hidden flex flex-col">
        <div className="sticky top-0 z-1 flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-[rgba(18,25,43,0.96)] backdrop-blur-[10px] -webkit-backdrop-blur-[10px]">
          <h3 className="text-sm font-bold">{req.title}</h3>
          <button className="flex-none w-8 h-8 grid place-items-center rounded-md border border-transparent text-text-3 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]" onClick={onClose} disabled={busy} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>
        <div className="p-5 text-text-2 leading-1.6">{req.message}</div>
        {req.warning && (
          <div className="mx-5 px-4 py-3 rounded-lg text-amber-300 leading-1.55 bg-amber/9 border border-amber/26 flex items-center gap-2">
            <IconAlert size={16} />
            {req.warning}
          </div>
        )}
        <div className="px-5 py-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={`btn ${req.danger ? "btn-red" : "btn-primary"}`} onClick={() => void req.onConfirm()} disabled={busy}>
            {busy ? <span className="btn-spinner" /> : null}
            {req.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
