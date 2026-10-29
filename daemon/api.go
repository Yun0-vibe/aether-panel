package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/docker/docker/client"
	"github.com/gorilla/websocket"
)

// attachRunning re-establishes console attach pipelines for containers that
// were already running when the daemon started.
func (api *daemonAPI) attachRunning() {
	for _, spec := range api.store.all() {
		if s, err := api.status(context.Background(), spec.ID); err == nil && s == "running" {
			api.hubs.attachLoop(api.docker, spec.ID)
		}
	}
}

func (api *daemonAPI) writeStdin(id string, data []byte) {
	if api.docker == nil {
		return
	}
	conn := api.hubs.connFor(id)
	if conn == nil {
		return
	}
	api.stdinMu.Lock()
	defer api.stdinMu.Unlock()
	conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	conn.Write(data)
}

type daemonAPI struct {
	token   string
	docker  *client.Client
	store   *store
	hubs    *hubManager
	dataDir string
	stdinMu sync.Mutex
}

// resolveDataDir is where persistent server files and backups live.
func resolveDataDir() string {
	if d := os.Getenv("AETHER_DATA_DIR"); d != "" {
		return d
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "aether", "data")
}

func (api *daemonAPI) serverDir(id string) string {
	return filepath.Join(api.dataDir, "containers", id)
}

func (api *daemonAPI) backupsDir(id string) string {
	return filepath.Join(api.dataDir, "backups", id)
}

func run(token, port string) error {
	st, err := newStore()
	if err != nil {
		return err
	}
	docker, err := newDocker()
	if err != nil {
		return err
	}
	api := &daemonAPI{
		token:   token,
		docker:  docker,
		store:   st,
		dataDir: resolveDataDir(),
		hubs: &hubManager{
			hubs:   map[string]*hub{},
			active: map[string]context.CancelFunc{},
			conns:  map[string]net.Conn{},
		},
	}
	if err := os.MkdirAll(filepath.Join(api.dataDir, "containers"), 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(api.dataDir, "backups"), 0o755); err != nil {
		return err
	}
	api.attachRunning()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	mux.Handle("POST /v1/servers", api.auth(http.HandlerFunc(api.createServer)))
	mux.Handle("GET /v1/servers", api.auth(http.HandlerFunc(api.listServers)))
	mux.Handle("GET /v1/servers/{id}", api.auth(http.HandlerFunc(api.getServer)))
	mux.Handle("POST /v1/servers/{id}/power", api.auth(http.HandlerFunc(api.powerServer)))
	mux.Handle("DELETE /v1/servers/{id}", api.auth(http.HandlerFunc(api.deleteServer)))
	mux.Handle("GET /v1/ws/{id}", api.authWS(http.HandlerFunc(api.consoleWS)))

	mux.Handle("GET /v1/files/{id}", api.auth(http.HandlerFunc(api.fileList)))
	mux.Handle("GET /v1/files/{id}/read", api.auth(http.HandlerFunc(api.fileRead)))
	mux.Handle("POST /v1/files/{id}/write", api.auth(http.HandlerFunc(api.fileWrite)))
	mux.Handle("POST /v1/files/{id}/upload", api.auth(http.HandlerFunc(api.fileUpload)))
	mux.Handle("GET /v1/files/{id}/tar", api.auth(http.HandlerFunc(api.fileTar)))
	mux.Handle("POST /v1/files/{id}/mkdir", api.auth(http.HandlerFunc(api.fileMkdir)))
	mux.Handle("POST /v1/files/{id}/delete", api.auth(http.HandlerFunc(api.fileDelete)))
	mux.Handle("POST /v1/files/{id}/rename", api.auth(http.HandlerFunc(api.fileRename)))

	mux.Handle("GET /v1/backups/{id}", api.auth(http.HandlerFunc(api.backupList)))
	mux.Handle("POST /v1/backups/{id}", api.auth(http.HandlerFunc(api.backupCreate)))
	mux.Handle("GET /v1/backups/{id}/{bid}", api.auth(http.HandlerFunc(api.backupDownload)))
	mux.Handle("POST /v1/backups/{id}/{bid}/restore", api.auth(http.HandlerFunc(api.backupRestore)))
	mux.Handle("DELETE /v1/backups/{id}/{bid}", api.auth(http.HandlerFunc(api.backupDelete)))

	log.Printf("aether daemon listening on :%s", port)
	return http.ListenAndServe(":"+port, mux)
}

func (api *daemonAPI) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+api.token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// authWS upgrades to websocket first, then validates the token from the query
// string (browsers cannot set Authorization headers on websocket connections).
func (api *daemonAPI) authWS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("token") != api.token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}



