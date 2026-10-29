package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
)

type backupMeta struct {
	ID        string    `json:"id"`
	SizeBytes int64     `json:"sizeBytes"`
	CreatedAt time.Time `json:"createdAt"`
}

func (api *daemonAPI) backupList(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := api.store.get(id); !ok {
		writeErr(w, fmt.Errorf("server not registered: %s", id), http.StatusNotFound)
		return
	}
	dir := api.backupsDir(id)
	_ = os.MkdirAll(dir, 0o755)
	entries, err := os.ReadDir(dir)
	if err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	out := []backupMeta{}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".tar.gz") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, backupMeta{
			ID:        strings.TrimSuffix(e.Name(), ".tar.gz"),
			SizeBytes: info.Size(),
			CreatedAt: info.ModTime(),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": out})
}

func newBackupID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return time.Now().UTC().Format("20060102-150405") + "-" + hex.EncodeToString(b)
}

// backupCreate snapshots the server's persistent directory into backups/.
func (api *daemonAPI) backupCreate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := api.store.get(id); !ok {
		writeErr(w, fmt.Errorf("server not registered: %s", id), http.StatusNotFound)
		return
	}
	root := api.serverDir(id)
	if err := os.MkdirAll(root, 0o755); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	dir := api.backupsDir(id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	bid := newBackupID()
	target := filepath.Join(dir, bid+".tar.gz")
	if err := tarDirectory(root, target); err != nil {
		os.Remove(target)
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	info, err := os.Stat(target)
	if err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, backupMeta{ID: bid, SizeBytes: info.Size(), CreatedAt: info.ModTime()})
}

func (api *daemonAPI) backupFilePath(id, bid string) (string, error) {
	clean := strings.TrimSuffix(filepath.Base(filepath.FromSlash(strings.ReplaceAll(bid, "\\", "/"))), ".tar.gz")
	if clean == "." || strings.Contains(clean, "/") || strings.ContainsAny(clean, "\x00") {
		return "", errors.New("invalid backup id")
	}
	if _, ok := api.store.get(id); !ok {
		return "", fmt.Errorf("server not registered")
	}
	return filepath.Join(api.backupsDir(id), clean+".tar.gz"), nil
}

func (api *daemonAPI) backupDownload(w http.ResponseWriter, r *http.Request) {
	target, err := api.backupFilePath(r.PathValue("id"), r.PathValue("bid"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	f, err := os.Open(target)
	if err != nil {
		writeErr(w, err, http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(target)))
	io.Copy(w, f)
}

func (api *daemonAPI) backupDelete(w http.ResponseWriter, r *http.Request) {
	target, err := api.backupFilePath(r.PathValue("id"), r.PathValue("bid"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	if err := os.Remove(target); err != nil {
		writeErr(w, err, http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": r.PathValue("bid")})
}

// backupRestore stops the container, wipes /data and unpacks the backup.
func (api *daemonAPI) backupRestore(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	target, err := api.backupFilePath(id, r.PathValue("bid"))
	if err != nil {
		writeErr(w, err, http.StatusBadRequest)
		return
	}
	if _, err := os.Stat(target); err != nil {
		writeErr(w, err, http.StatusNotFound)
		return
	}
	if api.docker != nil {
		// Best-effort stop: a running server must not write while we restore.
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		_ = api.docker.ContainerStop(ctx, containerName(id), container.StopOptions{Timeout: new(int)})
	}
	if err := restoreTar(target, api.serverDir(id)); err != nil {
		writeErr(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"restored": r.PathValue("bid"), "status": "stopped"})
}

func tarDirectory(root, target string) error {
	f, err := os.Create(target)
	if err != nil {
		return err
	}
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	err = filepath.Walk(root, func(path string, info os.FileInfo, werr error) error {
		if werr != nil {
			return werr
		}
		if info.Mode()&os.ModeSocket != 0 {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return nil // skip exotic entries
		}
		hdr.Name = filepath.ToSlash(rel)
		hdr.Uid, hdr.Gid = 0, 0
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if info.Mode().IsRegular() {
			src, err := os.Open(path)
			if err != nil {
				return nil
			}
			io.Copy(tw, src)
			src.Close()
		}
		return nil
	})
	if err != nil {
		return err
	}
	if err := tw.Close(); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}
	return f.Close()
}

const untarLimit = 8 << 30 // refuse archives claiming more than 8 GiB extracted

func untarMemberName(name string) (string, error) {
	name = filepath.ToSlash(name)
	name = strings.TrimPrefix(name, "./")
	clean := filepath.Clean("/" + name) // becomes e.g. /world/level.dat
	if strings.Contains(name, "../") {
		return "", fmt.Errorf("unsafe path in archive: %s", name)
	}
	return strings.TrimPrefix(clean, "/"), nil
}

// restoreTar extracts archives into the (already cleaned) target directory.
func restoreTar(archive, target string) error {
	f, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	tw := tar.NewReader(gz)
	var total int64
	for {
		hdr, err := tw.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("corrupt archive: %w", err)
		}
		total += hdr.Size
		if total > untarLimit {
			return errors.New("archive too large to restore")
		}
		rel, err := untarMemberName(hdr.Name)
		if err != nil {
			return err
		}
		if rel == "" || rel == "." {
			continue
		}
		dest := filepath.Join(target, filepath.FromSlash(rel))
		if !strings.HasPrefix(strings.ToLower(dest), strings.ToLower(strings.TrimSuffix(target, string(filepath.Separator))+string(filepath.Separator))) &&
			strings.ToLower(dest) != strings.ToLower(target) {
			return fmt.Errorf("archive member escapes target: %s", hdr.Name)
		}
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return err
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(dest, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tw); err != nil {
				out.Close()
				return err
			}
			out.Close()
		case tar.TypeSymlink:
			os.Remove(dest)
			if err := os.Symlink(filepath.FromSlash(hdr.Linkname), dest); err != nil {
				continue // tolerate cross-platform symlink failures
			}
		}
	}
	return nil
}
