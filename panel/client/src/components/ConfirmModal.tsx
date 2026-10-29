import React from "react";

export interface ConfirmRequest {
  title: string;
  message: React.ReactNode;
  /** Extra red warning box (e.g. restore wipes current files). */
  warning?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmModal({
  req,
  busy,
  onClose,
}: {
  req: ConfirmRequest | null;
  /** Rendered even while a confirmed action is running; pass true to keep the dialog up. */
  busy: boolean;
  onClose: () => void;
}) {
  if (!req) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal confirm-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{req.title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </div>
        <div className="confirm-text">{req.message}</div>
        {req.warning && <div className="confirm-warn">{req.warning}</div>}
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn ${req.danger ? "btn-red" : "btn-primary"}`}
            onClick={() => void req.onConfirm()}
            disabled={busy}
          >
            {busy ? <span className="btn-spinner" /> : null}
            {req.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
