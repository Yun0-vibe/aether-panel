package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/docker/docker/api/types/container"
)

type serverView struct {
	ServerSpec
	Status string `json:"status"`
}

func (api *daemonAPI) createServer(w http.ResponseWriter, r *http.Request) {
	var spec ServerSpec
	if err := json.NewDecoder(r.Body).Decode(&spec); err != nil || spec.ID == "" || spec.Image == "" {
		http.Error(w, "id and image are required", http.StatusBadRequest)
		return
	}
	if err := api.store.put(spec); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Pull the image and create the (stopped) container up front so the
	// panel gets image/build errors immediately, not on first start.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if err := api.ensureContainer(ctx, spec); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"server": spec, "warning": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"server": spec})
}

func (api *daemonAPI) listServers(w http.ResponseWriter, r *http.Request) {
	specs := api.store.all()
	views := make([]serverView, 0, len(specs))
	for _, spec := range specs {
		status, _ := api.status(r.Context(), spec.ID)
		views = append(views, serverView{spec, status})
	}
	writeJSON(w, http.StatusOK, map[string]any{"servers": views})
}

func (api *daemonAPI) getServer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	spec, ok := api.store.get(id)
	if !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	status, err := api.status(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"server": serverView{spec, status}})
}

func (api *daemonAPI) powerServer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	status, err := api.power(r.Context(), id, body.Action)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": status})
}

func (api *daemonAPI) deleteServer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := api.store.get(id); !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	timeout := 5
	_ = api.docker.ContainerStop(ctx, containerName(id), container.StopOptions{Timeout: &timeout})
	_ = api.docker.ContainerRemove(ctx, containerName(id), container.RemoveOptions{Force: true})
	api.hubs.stop(id)
	if err := api.store.delete(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": id})
}

// consoleWS upgrades to a websocket and pipes:
//   daemon → browser: {"t":"out","d":"<text>"} (replay + live output)
//   browser → daemon: {"t":"in","d":"<text>"}  (stdin into the container)
func (api *daemonAPI) consoleWS(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := api.store.get(id); !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if api.docker == nil {
		http.Error(w, "docker unavailable", http.StatusServiceUnavailable)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	h := api.hubs.hub(id)
	ch, unsubscribe := h.subscribe()
	defer unsubscribe()
	api.hubs.attachLoop(api.docker, id)

	// Replay recent output so the browser terminal isn't empty.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	replay, _ := api.lastLines(ctx, id)
	cancel()
	if replay != "" {
		if err := conn.WriteJSON(map[string]string{"t": "out", "d": replay}); err != nil {
			return
		}
	}

	done := make(chan struct{})
	go func() { // browser → container (stdin)
		defer close(done)
		for {
			var msg map[string]string
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}
			if msg["t"] == "in" && msg["d"] != "" {
				api.writeStdin(id, []byte(msg["d"]))
			}
		}
	}()

	for { // container → browser (live stdout/stderr)
		select {
		case d := <-ch:
			if err := conn.WriteJSON(map[string]string{"t": "out", "d": string(d)}); err != nil {
				return
			}
		case <-done:
			return
		}
	}
}



