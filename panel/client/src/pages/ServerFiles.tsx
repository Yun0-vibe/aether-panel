import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { ConfirmModal } from "../components/ConfirmModal";
import type { ConfirmRequest } from "../components/ConfirmModal";

interface FileEntry {
  name: string;
  size: number;
  dir: boolean;
  mode: string;
  modTime: string;
}

interface EditorState {
  path: string;
  content: string;
  saved: string;
  loading: boolean;
  saving: boolean;
  err: string | null;
}

/** Files above this size are not opened in the inline editor. */
const MAX_EDIT_BYTES = 512 * 1024;

function joinPath(dir: string, name: string) {
  return dir ? `${dir}/${name}` : name;
}

function segments(dir: string) {
  return dir ? dir.split("/").filter(Boolean) : [];
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

function dirIcon(e: FileEntry) {
  return e.dir ? "📁" : "📄";
}

export function FilesTab({ serverId }: { serverId: string }) {
  const toast = useToast();
  const base = `/api/servers/${encodeURIComponent(serverId)}`;

  const [dir, setDir] = useState(""); // "" = server root
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Load directory listing whenever the current dir changes.
  useEffect(() => {
    let alive = true;
    setEntries(null);
    setLoadErr(null);
    (async () => {
      try {
        const data = await api<{ entries: FileEntry[] }>(`${base}/files?path=${encodeURIComponent(dir)}`);
        if (alive) {
          setEntries(data.entries);
          setLoadErr(null);
        }
      } catch (e) {
        if (alive) setLoadErr(e instanceof ApiError ? e.message : "Failed to load files");
      }
    })();
    return () => {
      alive = false;
    };
  }, [dir, base]);

  const sorted = entries
    ? [...entries].sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
    : null;

  /** Refresh the listing after mutations. */
  const reload = useCallback(async () => {
    try {
      const data = await api<{ entries: FileEntry[] }>(`${base}/files?path=${encodeURIComponent(dir)}`);
      setEntries(data.entries);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : "Failed to load files");
    }
  }, [base, dir]);

  /* ---------- toolbar actions ---------- */

  async function onUploadPicked(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    setUploading(true);
    try {
      for (const f of files) {
        const qs = new URLSearchParams({ path: joinPath(dir, f.name) }).toString();
        const res = await fetch(`${base}/files/upload?${qs}`, {
          method: "POST",
          credentials: "include",
          body: f, // raw binary; no content-type header on purpose
        });
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error("Session expired");
        }
        if (!res.ok) throw new Error(`Upload of ${f.name} failed (${res.status})`);
      }
      toast.push(files.length === 1 ? `Uploaded ${files[0].name}` : `Uploaded ${files.length} files`, "success");
    } catch (e) {
      toast.pushError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
      void reload();
    }
  }

  async function newFile() {
    const name = window.prompt("New file name (relative to current directory):");
    if (!name || !name.trim()) return;
    const full = joinPath(dir, name.trim());
    try {
      await api(`${base}/files/write`, { method: "POST", body: { path: full, content: "" } });
      toast.push(`Created ${name.trim()}`, "success");
      setDir(dirOf(full)); // land in the same dir we created in
      await reload();
    } catch (e) {
      toast.pushError(e instanceof ApiError ? e.message : "Failed to create file");
    }
  }

  function dirOf(p: string) {
    const idx = p.lastIndexOf("/");
    return idx === -1 ? "" : p.slice(0, idx);
  }

  async function newFolder() {
    const name = window.prompt("New folder name (relative to current directory):");
    if (!name || !name.trim()) return;
    try {
      await api(`${base}/files`, { method: "POST", body: { action: "mkdir", path: joinPath(dir, name.trim()) } });
      toast.push(`Created folder ${name.trim()}`, "success");
      await reload();
    } catch (e) {
      toast.pushError(e instanceof ApiError ? e.message : "Failed to create folder");
    }
  }

  function downloadDir() {
    window.open(`${base}/files/tar?path=${encodeURIComponent(dir)}`);
  }

  /* ---------- row actions ---------- */

  function renameEntry(e: FileEntry) {
    const to = window.prompt(`Rename "${e.name}" to:`, e.name);
    if (!to || !to.trim() || to.trim() === e.name) return;
    void (async () => {
      try {
        await api(`${base}/files`, {
          method: "POST",
          body: { action: "rename", path: joinPath(dir, e.name), to: joinPath(dir, to.trim()) },
        });
        toast.push(`Renamed to ${to.trim()}`, "success");
        await reload();
      } catch (err) {
        toast.pushError(err instanceof ApiError ? err.message : "Rename failed");
      }
    })();
  }

  function deleteEntry(e: FileEntry) {
    // Never allow deleting the listing root itself.
    if (dir === "" && e.name === "..") return;
    setConfirmReq({
      title: "Delete",
      danger: true,
      confirmLabel: "Delete",
      message: (
        <>
          Delete <span className="mono">{joinPath(dir, e.name)}</span>
          {e.dir ? " and everything inside it" : ""}?
        </>
      ),
      warning: e.dir ? "Deleting a folder removes all files and subfolders inside it. This cannot be undone." : undefined,
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await api(`${base}/files`, { method: "POST", body: { action: "delete", path: joinPath(dir, e.name) } });
          toast.push(`Deleted ${e.name}`, "success");
          setConfirmReq(null);
          await reload();
        } catch (err) {
          toast.pushError(err instanceof ApiError ? err.message : "Delete failed");
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  /* ---------- inline editor ---------- */

  function openFile(e: FileEntry) {
    const full = joinPath(dir, e.name);
    if (e.size > MAX_EDIT_BYTES) {
      toast.push("File is too large to edit in the browser (only files up to 512 KB can be opened)", "error");
      return;
    }
    setEditor({ path: full, content: "", saved: "", loading: true, saving: false, err: null });
    void (async () => {
      try {
        const res = await fetch(`${base}/files/read?path=${encodeURIComponent(full)}`, { credentials: "include" });
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error("Session expired");
        }
        if (!res.ok) throw new Error(`Read failed (${res.status})`);
        const text = await res.text();
        setEditor((cur) => (cur && cur.path === full ? { ...cur, content: text, saved: text, loading: false } : null));
      } catch (err) {
        setEditor((cur) =>
          cur && cur.path === full
            ? { ...cur, loading: false, err: err instanceof Error ? err.message : "Failed to read file" }
            : null
        );
      }
    })();
  }

  async function saveEditor() {
    if (!editor) return;
    setEditor((cur) => (cur ? { ...cur, saving: true } : cur));
    try {
      await api(`${base}/files/write`, { method: "POST", body: { path: editor.path, content: editor.content } });
      toast.push(`Saved ${editor.path}`, "success");
      setEditor((cur) => (cur ? { ...cur, saved: cur.content, saving: false } : cur));
    } catch (e) {
      toast.pushError(e instanceof ApiError ? e.message : "Save failed");
      setEditor((cur) => (cur ? { ...cur, saving: false } : cur));
    }
  }

  function closeEditor() {
    if (editor && editor.content !== editor.saved) {
      if (!window.confirm("You have unsaved changes. Discard them?")) return;
    }
    setEditor(null);
  }

  /* ---------- render ---------- */

  const segs = segments(dir);

  return (
    <>
      <section className="card table-card files-card">
        <div className="files-toolbar">
          <nav className="path-crumb" aria-label="Current path">
            <button className={dir === "" ? "crumb-here" : ""} onClick={() => setDir("")}>
              /
            </button>
            {segs.map((s, i) => {
              const target = segs.slice(0, i + 1).join("/");
              const here = i === segs.length - 1;
              return (
                <React.Fragment key={target}>
                  <span className="path-sep">›</span>
                  <button
                    className={here ? "crumb-here" : ""}
                    onClick={() => setDir(target)}
                    title={target}
                  >
                    {s}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
          <div className="files-actions">
            <button className="btn btn-sm" disabled={uploading} onClick={() => uploadRef.current?.click()}>
              {uploading ? <span className="btn-spinner" /> : "⬆"} Upload
            </button>
            <input
              ref={uploadRef}
              type="file"
              multiple
              hidden
              onChange={(ev) => void onUploadPicked(ev.target.files)}
            />
            <button className="btn btn-sm" onClick={() => void newFile()}>
              + New File
            </button>
            <button className="btn btn-sm" onClick={() => void newFolder()}>
              + New Folder
            </button>
            <button className="btn btn-sm" onClick={downloadDir} title="Download this directory as tar.gz">
              ⬇ Download Dir
            </button>
          </div>
        </div>

        {loadErr !== null && <div className="files-error">{loadErr}</div>}
        {loadErr === null && sorted !== null && sorted.length === 0 && (
          <div className="files-empty">No files yet — upload something or create a new file.</div>
        )}

        {loadErr === null && sorted !== null && sorted.length > 0 && (
          <table className="table files-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Modified</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.name}>
                  <td>
                    <span className="file-icon" aria-hidden>
                      {dirIcon(e)}
                    </span>
                    {e.dir ? (
                      <button
                        className="file-name-btn"
                        title={`Open folder ${e.name}`}
                        onClick={() => setDir(joinPath(dir, e.name))}
                      >
                        {e.name}/
                      </button>
                    ) : (
                      <button
                        className="file-name-btn"
                        title={
                          e.size <= MAX_EDIT_BYTES ? "Open in editor" : "Too large to edit in the browser"
                        }
                        onClick={() => openFile(e)}
                      >
                        {e.name}
                      </button>
                    )}
                  </td>
                  <td className="muted">{e.dir ? "—" : humanSize(e.size)}</td>
                  <td className="muted">
                    {e.modTime ? new Date(e.modTime).toLocaleString() : "—"}
                  </td>
                  <td className="td-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => renameEntry(e)}>
                      Rename
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => deleteEntry(e)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editor && (
        <div className="editor-backdrop" onMouseDown={(ev) => ev.target === ev.currentTarget && closeEditor()}>
          <div className="editor" role="dialog" aria-modal="true">
            <div className="editor-head">
              <h3>
                <span className="mono">{editor.path}</span>
                {editor.content !== editor.saved && !editor.loading && (
                  <span className="unsaved-dot" title="Unsaved changes" />
                )}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={closeEditor} disabled={editor.saving}>
                ✕
              </button>
            </div>
            {editor.err ? (
              <div className="editor-body">
                <div className="inline-alert">{editor.err}</div>
              </div>
            ) : editor.loading ? (
              <div className="editor-body editor-loading">
                <span className="spinner" />
              </div>
            ) : (
              <textarea
                className="editor-text"
                value={editor.content}
                spellCheck={false}
                onChange={(ev) => setEditor((cur) => (cur ? { ...cur, content: ev.target.value } : cur))}
              />
            )}
            <div className="editor-actions">
              <button className="btn btn-primary" onClick={() => void saveEditor()} disabled={editor.saving || editor.loading || editor.err !== null}>
                {editor.saving ? <span className="btn-spinner" /> : null}
                {editor.saving ? "Saving…" : "Save"}
              </button>
              <button className="btn btn-ghost" onClick={closeEditor} disabled={editor.saving}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal req={confirmReq} busy={confirmBusy} onClose={() => setConfirmReq(null)} />
    </>
  );
}
