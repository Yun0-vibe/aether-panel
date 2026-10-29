package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// ServerSpec is what the panel sends when registering a server with the daemon.
type ServerSpec struct {
	ID       string            `json:"id"`
	Image    string            `json:"image"`
	Env      map[string]string `json:"env,omitempty"`
	HostPort int               `json:"hostPort,omitempty"`
	// Ports replaces HostPort when set: fully explicit expose/bind list.
	Ports []PortSpec `json:"ports,omitempty"`
	MemoryMB int      `json:"memoryMB,omitempty"`
	CPUs     float64  `json:"cpus,omitempty"` // fractional cores
	Command  string   `json:"command,omitempty"` // shell command overriding the image entrypoint
	Owner    string   `json:"owner,omitempty"`   // panel user id, informational
	Name     string   `json:"name,omitempty"`
}

// PortSpec is a container port to expose and bind on the host.
type PortSpec struct {
	Port     int    `json:"port"`
	Protocol string `json:"protocol"` // "tcp" | "udp"
}

// store persists server specs as JSON so the daemon survives restarts.
type store struct {
	mu      sync.Mutex
	path    string
	servers map[string]ServerSpec
}

func newStore() (*store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	if custom := os.Getenv("AETHER_CONFIG_DIR"); custom != "" {
		dir = custom
	}
	path := filepath.Join(dir, "aether", "servers.json")

	s := &store{path: path, servers: map[string]ServerSpec{}}
	data, err := os.ReadFile(path)
	if err == nil {
		if err := json.Unmarshal(data, &s.servers); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func (s *store) get(id string) (ServerSpec, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	spec, ok := s.servers[id]
	return spec, ok
}

func (s *store) all() []ServerSpec {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]ServerSpec, 0, len(s.servers))
	for _, spec := range s.servers {
		out = append(out, spec)
	}
	return out
}

func (s *store) put(spec ServerSpec) error {
	s.mu.Lock()
	s.servers[spec.ID] = spec
	s.mu.Unlock()
	return s.save()
}

func (s *store) delete(id string) error {
	s.mu.Lock()
	delete(s.servers, id)
	s.mu.Unlock()
	return s.save()
}

func (s *store) save() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := json.MarshalIndent(s.servers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o600)
}



