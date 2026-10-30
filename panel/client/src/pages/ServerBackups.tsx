import React, { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { ConfirmModal } from "../components/ConfirmModal";
import type { ConfirmRequest } from "../components/ConfirmModal";
import { IconDownload, IconRefresh, IconTrash, IconArchive } from "../components/Icons";

interface Backup { id: string; sizeBytes: number; createdAt: string; }
function humanSize(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"]; let v = n; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
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
      setBackups(data.backups); setLoadErr(null);
    } catch (e) { setLoadErr(e instanceof ApiError ? e.message : "Failed to load backups"); }
  }, [base]);
  useEffect(() => { void reload(); }, [reload]);

  async function createBackup() {
    setCreating(true);
    toast.push("Backup started — this can take a while depending on server size…", "info");
    try {
      const b = await api<Backup>(`${base}/backups`, { method: "POST" });
      toast.push(`Backup ${b.id} created (${humanSize(b.sizeBytes)})`, "success");
      await reload();
    } catch (e) { toast.pushError(e instanceof ApiError ? e.message : "Backup failed"); } finally { setCreating(false); }
  }

  function downloadBackup(b: Backup) { window.open(`${base}/backups/${encodeURIComponent(b.id)}`); }

  function askRestore(b: Backup) {
    setConfirmReq({ title: "Restore backup", confirmLabel: "Restore", message: (<>Restore backup <span className="mono">{b.id}</span> ({humanSize(b.sizeBytes)})?</>), warning: "Restoring replaces EVERY file currently on the server with the contents of this backup — anything added or changed since the backup was taken will be wiped. The server is stopped during the restore and must be started again from the Console tab.", onConfirm: async () => { setConfirmBusy(true); try { await api(`${base}/backups/${encodeURIComponent(b.id)}/restore`, { method: "POST" }); toast.push("Restored; server stopped (start it in Console tab)", "success"); setConfirmReq(null); } catch (e) { toast.pushError(e instanceof ApiError ? e.message : "Restore failed"); } finally { setConfirmBusy(false); } } });
  }

  function askDelete(b: Backup) {
    setConfirmReq({ title: "Delete backup", danger: true, confirmLabel: "Delete", message: (<>Permanently delete backup <span className="mono">{b.id}</span>?</>), warning: "Deleted backups cannot be recovered. Download it first if you want to keep a copy.", onConfirm: async () => { setConfirmBusy(true); try { await api(`/api/servers/${encodeURIComponent(serverId)}/backups/${encodeURIComponent(b.id)}`, { method: "DELETE" }); toast.push(`Deleted backup ${b.id}`, "success"); setConfirmReq(null); await reload(); } catch (e) { toast.pushError(e instanceof ApiError ? e.message : "Delete failed"); } finally { setConfirmBusy(false); } } });
  }

  return (
    <>
      <section className="card table-card files-card overflow-hidden">
        <div className="files-toolbar flex items-center justify-between gap-[14px] px-[14px] py-[14px] border-b border-border bg-white/1 flex-wrap">
          <p className="backup-hint text-[12.5px] text-text-2">Backups are full snapshots of the server directory, including the world.</p>
          <div className="files-actions flex gap-[6px] flex-wrap"><button className="btn btn-primary btn-sm" onClick={() => void createBackup()} disabled={creating}>{creating ? <span className="btn-spinner" /> : null}{creating ? "Creating backup…" : "Create backup"}</button></div>
        </div>
        {loadErr !== null && <div className="files-error p-[16px] text-red-400 text-[13px]">{loadErr}</div>}
        {loadErr === null && backups !== null && backups.length === 0 && (
          <div className="files-empty flex flex-col items-center gap-[6px] p-[44px] p-[20px] text-center text-[13px] text-text-3"><span className="empty-art small flex items-center justify-center w-[54px] h-[54px] rounded-[16px] bg-brand/7 border border-brand/22 mb-[4px] mx-auto text-brand"><IconArchive size={26} className="flex-none" /></span><strong className="text-text text-[14.5px]">No backups yet</strong><span>Create one to snapshot the entire server directory.</span></div>
        )}
        {loadErr === null && backups !== null && backups.length > 0 && (
          <table className="table files-table">
            <thead><tr><th>Backup</th><th>Size</th><th>Created</th><th className="th-actions">Actions</th></tr></thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td className="mono text-[13px]">{b.id}</td><td className="muted text-[13px]">{humanSize(b.sizeBytes)}</td><td className="muted text-[13px]">{b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}</td>
                  <td className="td-actions flex justify-end gap-[6px]">
                    <button className="btn btn-ghost btn-sm btn-icon-text" onClick={() => downloadBackup(b)}><IconDownload size={14} className="flex-none" /> Download</button>
                    <button className="btn btn-ghost btn-sm btn-icon-text" onClick={() => askRestore(b)}><IconRefresh size={14} className="flex-none" /> Restore</button>
                    <button className="btn btn-ghost btn-sm btn-icon-text btn-danger-text" onClick={() => askDelete(b)}><IconTrash size={14} className="flex-none" /> Delete</button>
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
