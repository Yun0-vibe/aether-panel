import React, { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { ConfirmModal } from "../components/ConfirmModal";
import type { ConfirmRequest } from "../components/ConfirmModal";

interface Backup {
  id: string;
  sizeBytes: number;
  createdAt: string;
}

function humanSize(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function BackupsTab({ serverId }: { serverId: string }) {
  const toast = useToast();
  const base = `/api/servers/${encodeURIComponent(serverId)}`;

  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = await api<{ backups: Backup[] }>(`${base}/backups`);
      setBackups(data.backups);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : "Failed to load backups");
    }
  }, [base]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createBackup() {
    setCreating(true);
    toast.push("Backup started — this can take a while depending on server size…", "info");
    try {
      const b = await api<Backup>(`${base}/backups`, { method: "POST" });
      toast.push(`Backup ${b.id} created (${humanSize(b.sizeBytes)})`, "success");
      await reload();
    } catch (e) {
      toast.pushError(e instanceof ApiError ? e.message : "Backup failed");
    } finally {
      setCreating(false);
    }
  }

  function downloadBackup(b: Backup) {
    window.open(`${base}/backups/${encodeURIComponent(b.id)}`);
  }

  function askRestore(b: Backup) {
    setConfirmReq({
      title: "Restore backup",
      confirmLabel: "Restore",
      message: (
        <>
          Restore backup <span className="mono">{b.id}</span> ({humanSize(b.sizeBytes)})?
        </>
      ),
      warning:
        "Restoring replaces EVERY file currently on the server with the contents of this backup — anything added or changed since the backup was taken will be wiped. The server is stopped during the restore and must be started again from the Console tab.",
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await api(`${base}/backups/${encodeURIComponent(b.id)}/restore`, { method: "POST" });
          toast.push("Restored; server stopped (start it in Console tab)", "success");
          setConfirmReq(null);
        } catch (e) {
          toast.pushError(e instanceof ApiError ? e.message : "Restore failed");
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  function askDelete(b: Backup) {
    setConfirmReq({
      title: "Delete backup",
      danger: true,
      confirmLabel: "Delete",
      message: (
        <>
          Permanently delete backup <span className="mono">{b.id}</span>?
        </>
      ),
      warning: "Deleted backups cannot be recovered. Download it first if you want to keep a copy.",
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await api(`/api/servers/${encodeURIComponent(serverId)}/backups/${encodeURIComponent(b.id)}`, {
            method: "DELETE",
          });
          toast.push(`Deleted backup ${b.id}`, "success");
          setConfirmReq(null);
          await reload();
        } catch (e) {
          toast.pushError(e instanceof ApiError ? e.message : "Delete failed");
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  return (
    <>
      <section className="card table-card files-card">
        <div className="files-toolbar">
          <p className="backup-hint">Backups are full snapshots of the server directory, including the world.</p>
          <div className="files-actions">
            <button className="btn btn-primary btn-sm" onClick={() => void createBackup()} disabled={creating}>
              {creating ? <span className="btn-spinner" /> : null}
              {creating ? "Creating backup…" : "Create backup"}
            </button>
          </div>
        </div>

        {loadErr !== null && <div className="files-error">{loadErr}</div>}
        {loadErr === null && backups !== null && backups.length === 0 && (
          <div className="files-empty">No backups yet — create one to snapshot the server.</div>
        )}

        {loadErr === null && backups !== null && backups.length > 0 && (
          <table className="table files-table">
            <thead>
              <tr>
                <th>Backup</th>
                <th>Size</th>
                <th>Created</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.id}</td>
                  <td className="muted">{humanSize(b.sizeBytes)}</td>
                  <td className="muted">{b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}</td>
                  <td className="td-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadBackup(b)}>
                      Download
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => askRestore(b)}>
                      Restore
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => askDelete(b)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmModal req={confirmReq} busy={confirmBusy} onClose={() => setConfirmReq(null)} />
    </>
  );
}
