import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { ConfirmModal } from "../components/ConfirmModal";
import type { ConfirmRequest } from "../components/ConfirmModal";
import { IconUpload, IconDownload, IconPlus, IconFolder, IconFile, IconClose, IconTrash, IconEdit } from "../components/Icons";

interface FileEntry { name: string; size: number; dir: boolean; mode: string; modTime: string; }
interface EditorState { path: string; content: string; saved: string; loading: boolean; saving: boolean; err: string | null; }
const MAX_EDIT_BYTES = 512 * 1024;

function joinPath(dir: string, name: string) { return dir ? `${dir}/${name}` : name; }
function segments(dir: string) { return dir ? dir.split("/").filter(Boolean) : []; }
function humanSize(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"]; let v = n; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function FilesTab({ serverId }: { serverId: string }) {
  const toast = useToast();
  const base = `/api/servers/${encodeURIComponent(serverId)}`;
  const [dir, setDir] = useState("");
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    let alive = true; setEntries(null); setLoadErr(null);
    (async () => {
      try {
        const data = await api<{ entries: FileEntry[] }>(`${base}/files?path=${encodeURIComponent(dir)}`);
        if (alive) { setEntries(data.entries); setLoadErr(null); }
      } catch (e) { if (alive) setLoadErr(e instanceof ApiError ? e.message : "Failed to load files"); }
    })(); return () => { alive = false; };
  }, [dir, base]);

  const sorted = entries ? [...entries].sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1)) : null;

  const reload = useCallback(async () => {
    try {
      const data = await api<{ entries: FileEntry[] }>(`${base}/files?path=${encodeURIComponent(dir)}`);
      setEntries(data.entries); setLoadErr(null);
    } catch (e) { setLoadErr(e instanceof ApiError ? e.message : "Failed to load files"); }
  }, [base, dir]);

  async function onUploadPicked(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list); setUploading(true);
    try {
      for (const f of files) {
        const qs = new URLSearchParams({ path: joinPath(dir, f.name) }).toString();
        const res = await fetch(`${base}/files/upload?${qs}`, { method: "POST", credentials: "include", body: f });
        if (res.status === 401) { window.location.href = "/login"; throw new Error("Session expired"); }
        if (!res.ok) throw new Error(`Upload of ${f.name} failed (${res.status})`);
      }
      toast.push(files.length === 1 ? `Uploaded ${files[0].name}` : `Uploaded ${files.length} files`, "success");
    } catch (e) { toast.pushError(e instanceof Error ? e.message : "Upload failed"); } finally { setUploading(false); if (uploadRef.current) uploadRef.current.value = ""; void reload(); }
  }

  async function newFile() {
    const name = window.prompt("New file name (relative to current directory):");
    if (!name || !name.trim()) return;
    try {
      await api(`${base}/files/write`, { method: "POST", body: { path: joinPath(dir, name.trim()), content: "" } });
      toast.push(`Created ${name.trim()}`, "success");
      setDir(dirOf(joinPath(dir, name.trim())));
      await reload();
    } catch (e) { toast.pushError(e instanceof ApiError ? e.message : "Failed to create file"); }
  }
  function dirOf(p: string) { const idx = p.lastIndexOf("/"); return idx === -1 ? "" : p.slice(0, idx); }

  async function newFolder() {
    const name = window.prompt("New folder name (relative to current directory):");
    if (!name || !name.trim()) return;
    try {
      await api(`${base}/files`, { method: "POST", body: { action: "mkdir", path: joinPath(dir, name.trim()) } });
      toast.push(`Created folder ${name.trim()}`, "success");
      await reload();
    } catch (e) { toast.pushError(e instanceof ApiError ? e.message : "Failed to create folder"); }
  }

  function downloadDir() { window.open(`${base}/files/tar?path=${encodeURIComponent(dir)}`); }

  function renameEntry(e: FileEntry) {
    const to = window.prompt(`Rename "${e.name}" to:`, e.name);
    if (!to || !to.trim() || to.trim() === e.name) return;
    void (async () => {
      try {
        await api(`${base}/files`, { method: "POST", body: { action: "rename", path: joinPath(dir, e.name), to: joinPath(dir, to.trim()) } });
        toast.push(`Renamed to ${to.trim()}`, "success");
        await reload();
      } catch (err) { toast.pushError(err instanceof ApiError ? err.message : "Rename failed"); }
    })();
  }

  function deleteEntry(e: FileEntry) {
    if (dir === "" && e.name === "..") return;
    setConfirmReq({ title: "Delete", danger: true, confirmLabel: "Delete", message: (<>Delete <span className="mono">{joinPath(dir, e.name)}</span>{e.dir ? " and everything inside it" : ""}?</>), warning: e.dir ? "Deleting a folder removes all files and subfolders inside it. This cannot be undone." : undefined, onConfirm: async () => { setConfirmBusy(true); try { await api(`${base}/files`, { method: "POST", body: { action: "delete", path: joinPath(dir, e.name) } }); toast.push(`Deleted ${e.name}`, "success"); setConfirmReq(null); await reload(); } catch (err) { toast.pushError(err instanceof ApiError ? err.message : "Delete failed"); } finally { setConfirmBusy(false); } } });
  }

  function openFile(e: FileEntry) {
    const full = joinPath(dir, e.name);
    if (e.size > MAX_EDIT_BYTES) { toast.push("File is too large to edit in the browser (only files up to 512 KB can be opened)", "error"); return; }
    setEditor({ path: full, content: "", saved: "", loading: true, saving: false, err: null });
    void (async () => {
      try {
        const res = await fetch(`${base}/files/read?path=${encodeURIComponent(full)}`, { credentials: "include" });
        if (res.status === 401) { window.location.href = "/login"; throw new Error("Session expired"); }
        if (!res.ok) throw new Error(`Read failed (${res.status})`);
        const text = await res.text();
        setEditor((cur) => (cur && cur.path === full ? { ...cur, content: text, saved: text, loading: false } : null));
      } catch (err) { setEditor((cur) => cur && cur.path === full ? { ...cur, loading: false, err: err instanceof Error ? err.message : "Failed to read file" } : null); }
    })();
  }

  async function saveEditor() {
    if (!editor) return;
    setEditor((cur) => (cur ? { ...cur, saving: true } : cur));
    try {
      await api(`${base}/files/write`, { method: "POST", body: { path: editor.path, content: editor.content } });
      toast.push(`Saved ${editor.path}`, "success");
      setEditor((cur) => (cur ? { ...cur, saved: cur.content, saving: false } : cur));
    } catch (e) { toast.pushError(e instanceof ApiError ? e.message : "Save failed"); setEditor((cur) => (cur ? { ...cur, saving: false } : cur)); }
  }

  function closeEditor() {
    if (editor && editor.content !== editor.saved) { if (!window.confirm("You have unsaved changes. Discard them?")) return; }
    setEditor(null);
  }

  const segs = segments(dir);

  return (
    <>
      <section className="card table-card files-card overflow-hidden">
        <div className="files-toolbar flex items-center justify-between gap-[14px] px-[14px] py-[14px] border-b border-border bg-white/1 flex-wrap">
          <nav className="path-crumb flex items-center gap-[4px] font-mono text-[12px] text-text-3 flex-wrap">
            <button className={dir === "" ? "crumb-here px-[3px] py-[1px] rounded-[7px] text-text-2 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-brand hover:bg-brand/7" : "px-[3px] py-[1px] rounded-[7px] text-text-2 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-brand hover:bg-brand/7"} onClick={() => setDir("")} title="/">/</button>
            {segs.map((s, i) => {
              const target = segs.slice(0, i + 1).join("/");
              const here = i === segs.length - 1;
              return (
                <React.Fragment key={target}><span className="path-sep text-text-3">›</span><button className={here ? "crumb-here px-[3px] py-[1px] rounded-[7px] text-text-2 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-brand hover:bg-brand/7" : "px-[3px] py-[1px] rounded-[7px] text-text-2 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-brand hover:bg-brand/7"} onClick={() => setDir(target)} title={target}>{s}</button></React.Fragment>
              );
            })}
          </nav>
          <div className="files-actions flex gap-[6px] flex-wrap">
            <button className="btn btn-sm" disabled={uploading} onClick={() => uploadRef.current?.click()}>{uploading ? <span className="btn-spinner" /> : <IconUpload size={15} className="flex-none" />} Upload</button>
            <input ref={uploadRef} type="file" multiple hidden onChange={(ev) => void onUploadPicked(ev.target.files)} />
            <button className="btn btn-sm" onClick={() => void newFile()}>
              <IconPlus size={15} className="flex-none" /> New File</button>
            <button className="btn btn-sm" onClick={() => void newFolder()}><IconPlus size={15} className="flex-none" /> New Folder</button>
            <button className="btn btn-sm" onClick={downloadDir} title="Download this directory as tar.gz"><IconDownload size={15} className="flex-none" /> Download Dir</button>
          </div>
        </div>
        {loadErr !== null && <div className="files-error p-[16px] text-red-400 text-[13px]">{loadErr}</div>}
        {loadErr === null && sorted !== null && sorted.length === 0 && (
          <div className="files-empty flex flex-col items-center gap-[6px] p-[44px] p-[20px] text-center text-[13px] text-text-3">
            <strong className="text-text text-[14.5px]">No files yet</strong><span>Upload something or create a new file.</span>
          </div>
        )}
        {loadErr === null && sorted !== null && sorted.length > 0 && (
          <table className="table files-table">
            <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th className="th-actions">Actions</th></tr></thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.name}>
                  <td><span className="file-icon inline-grid place-items-center w-[26px] h-[26px] rounded-[8px] text-brand bg-brand/9 border border-border mr-[8px] vertical-middle">{e.dir ? <IconFolder size={16} className="flex-none" /> : <IconFile size={16} className="flex-none" />}</span><button className="file-name-btn text-left font-semibold text-white transition-colors duration-150 hover:text-brand hover:underline hover:text-underline-offset-[3px]" title={e.dir ? `Open folder ${e.name}` : e.size <= MAX_EDIT_BYTES ? "Open in editor" : "Too large to edit in the browser"} onClick={() => e.dir ? setDir(joinPath(dir, e.name)) : openFile(e)}>{e.name}{e.dir ? "/" : ""}</button></td>
                  <td className="muted text-[13px]">{e.dir ? "—" : humanSize(e.size)}</td>
                  <td className="muted text-[13px]">{e.modTime ? new Date(e.modTime).toLocaleString() : "—"}</td>
                  <td className="td-actions flex justify-end gap-[6px]">
                    <button className="btn btn-ghost btn-sm btn-icon-text" onClick={() => renameEntry(e)}><IconEdit size={14} className="flex-none" /> Rename</button>
                    <button className="btn btn-ghost btn-sm btn-icon-text btn-danger-text" onClick={() => deleteEntry(e)}><IconTrash size={14} className="flex-none" /> Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editor && (
        <div className="editor-backdrop fixed inset-0 z-[220] flex items-center justify-center p-6 bg-[#03060e]/74 backdrop-blur-[10px] -webkit-backdrop-blur-[10px] animate-[fade-in_200ms_var(--ease)]" onMouseDown={(ev) => ev.target === ev.currentTarget && closeEditor()}>
          <div className="editor w-full max-w-[900px] max-h-[86vh] flex flex-col rounded-[24px] bg-gradient-to-b from-[rgba(18,25,43,0.98)] to-[rgba(11,16,29,0.98)] border border-white/12 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] animate-[modal-in_300ms_var(--ease)] overflow-hidden">
            <div className="editor-head flex items-center justify-between gap-[12px] px-[14px] py-[14px] border-b border-border">
              <h3 className="flex items-center gap-[9px] text-[13px] min-w-[0]"><span className="mono trunc">{editor.path}</span>{editor.content !== editor.saved && !editor.loading && <span className="unsaved-dot flex-none w-[7px] h-[7px] rounded-full bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]" title="Unsaved changes" />}</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={closeEditor} disabled={editor.saving} aria-label="Close editor"><IconClose size={16} className="flex-none" /></button>
            </div>
            {editor.err ? (<div className="editor-body flex-1 overflow-auto p-[16px]"><div className="inline-alert flex items-center gap-[8px] px-[13px] py-[10px] rounded-lg text-red-400 bg-red/10 border border-red/30 text-[12.5px]">{editor.err}</div></div>) : editor.loading ? (<div className="editor-body grid place-items-center min-h-[220px]"><span className="spinner" /></div>) : (<textarea className="editor-text w-full min-h-[380px] p-[14px] rounded-lg bg-[#04060c] border border-border font-mono text-[12.5px] leading-[1.65] text-slate-300 resize-y outline-none focus:border-brand/60" value={editor.content} spellCheck={false} onChange={(ev) => setEditor((cur) => (cur ? { ...cur, content: ev.target.value } : cur))} />)}
            <div className="editor-actions flex justify-end gap-[9px] px-[14px] py-[14px] border-t border-border"><button className="btn btn-primary" onClick={() => void saveEditor()} disabled={editor.saving || editor.loading || editor.err !== null}>{editor.saving ? <span className="btn-spinner" /> : null}{editor.saving ? "Saving…" : "Save"}</button><button className="btn btn-ghost" onClick={closeEditor} disabled={editor.saving}>Close</button></div>
          </div>
        </div>
      )}

      <ConfirmModal req={confirmReq} busy={confirmBusy} onClose={() => setConfirmReq(null)} />
    </>
  );
}
