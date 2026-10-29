package main

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxFileBytes = 64 << 20 // single read/write cap: 64 MiB

type fileEntry struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	IsDir   bool      `json:"dir"`
	Mode    string    `json:"mode"`
	ModTime time.Time `json:"modTime"`
}

// resolve keeps every file operation inside the server's own directory.
func resolve(root, p string) (string, error) {
	cleaned := "/" + strings.TrimLeft(strings.ReplaceAll(p, "\\", "/"), "/")
	full := filepath.Clean(filepath.Join(root, filepath.FromSlash(cleaned)))
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	fullAbs, err := filepath.Abs(full)
	if err != nil {
		return "", err
	}
	if fullAbs != rootAbs && !strings.HasPrefix(fullAbs, rootAbs+string(filepath.Separator)) {
		return "", errors.New("path escapes server directory")
	}
	return fullAbs, nil
}

func writeErr(w http.ResponseWriter, err error, status int) {
	http.Error(w, err.Error(), status)
}

// guards verifies the server is registered and path stays in bounds.
func (api *daemonAPI) fileRoot(w http.ResponseWriter, id string) (string, bool) {
	if _, ok := api.store.get(id); !ok {
		writeErr(w, fmt.Errorf("server not registered: %s", id), http.StatusNotFound)
		return "", false
	}
	root, err := resolve(api.serverDir(id), "")
	if err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return "", false
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return "", false
	}
	return root, true
}

func (api *daemonAPI) fileList(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	sub, err := resolve(root, r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	st, err := os.Stat(sub)
	if err != nil {
		writeErr(w, err, http.StatusNotFound)
		return
	}
	if !st.IsDir() {
		writeErr(w, fmt.Errorf("not a directory"), http.StatusBadRequest)
		return
	}
	entries, err := os.ReadDir(sub)
	if err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	out := make([]fileEntry, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".aether") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, fileEntry{
			Name:    name,
			Size:    info.Size(),
			IsDir:   e.IsDir(),
			Mode:    info.Mode().String(),
			ModTime: info.ModTime(),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": out})
}

func (api *daemonAPI) fileRead(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	full, err := resolve(root, r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	f, err := os.Open(full)
	if err != nil {
		writeErr(w, err, http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/octet-stream")
	io.Copy(w, io.LimitReader(f, maxFileBytes))
}

// fileWrite takes the raw body as the complete new file content.
func (api *daemonAPI) fileWrite(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	full, err := resolve(root, r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	f, err := os.CreateTemp(filepath.Dir(full), ".aether-w-*")
	if err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	defer os.Remove(f.Name())
	if _, err := io.Copy(f, io.LimitReader(r.Body, maxFileBytes)); err != nil {
		f.Close()
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	f.Close()
	if err := os.Rename(f.Name(), full); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"written": full})
}

// fileUpload streams an uploaded file to path (must include the filename).
func (api *daemonAPI) fileUpload(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	full, err := resolve(root, r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	if strings.HasSuffix(full, "/") || strings.HasSuffix(full, string(filepath.Separator)) || filepath.Base(full) == "." {
		writeErr(w, fmt.Errorf("path must include a filename"), http.StatusBadRequest)
		return
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	f, err := os.Create(full)
	if err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	if _, err := io.Copy(f, io.LimitReader(r.Body, 1<<30)); err != nil {
		f.Close()
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	f.Close()
	writeJSON(w, http.StatusCreated, map[string]string{"uploaded": full})
}

// fileTar streams the requested subtree as a tar.gz archive.
func (api *daemonAPI) fileTar(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	sub, err := resolve(root, r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	gz := gzip.NewWriter(w)
	tw := tar.NewWriter(gz)
	err = filepath.Walk(sub, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSocket != 0 {
			return nil
		}
		rel, err := filepath.Rel(sub, path)
		if err != nil {
			return err
		}
		name := filepath.ToSlash(rel)
		if rel == "." {
			return nil
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return nil // skip exotic entries rather than failing the archive
		}
		hdr.Name = name
		hdr.Uid, hdr.Gid = 0, 0
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if info.Mode().IsRegular() {
			f, err := os.Open(path)
			if err != nil {
				return nil
			}
			io.Copy(tw, f)
			f.Close()
		}
		return nil
	})
	if err != nil {
		// headers may already be written; just drop the connection state
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tw.Close()
	gz.Close()
}

func (api *daemonAPI) fileMkdir(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	full, err := resolve(root, r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	if err := os.MkdirAll(full, 0o755); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"dir": full})
}

func (api *daemonAPI) fileDelete(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	full, err := resolve(root, r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	if full == root {
		writeErr(w, fmt.Errorf("refusing to delete server root"), http.StatusBadRequest)
		return
	}
	if err := os.RemoveAll(full); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": full})
}

func (api *daemonAPI) fileRename(w http.ResponseWriter, r *http.Request) {
	root, ok := api.fileRoot(w, r.PathValue("id"))
	if !ok {
		return
	}
	var body struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	from, err := resolve(root, body.From)
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	to, err := resolve(root, body.To)
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	if err := os.Rename(from, to); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"renamed": to})
}
