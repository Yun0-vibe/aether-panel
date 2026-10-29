package main

import (
	"bytes"
	"context"
	"io"
	"log"
	"net"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

// hub broadcasts console output of one server to every websocket subscriber.
type hub struct {
	mu   sync.Mutex
	subs map[chan []byte]struct{}
}

func newHub() *hub {
	return &hub{subs: map[chan []byte]struct{}{}}
}

func (h *hub) subscribe() (chan []byte, func()) {
	ch := make(chan []byte, 512)
	h.mu.Lock()
	h.subs[ch] = struct{}{}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		delete(h.subs, ch)
		h.mu.Unlock()
	}
}

func (h *hub) broadcast(d []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs {
		select {
		case ch <- d:
		default: // slow subscriber: drop rather than block the stream
		}
	}
}

type hubManager struct {
	mu     sync.Mutex
	hubs   map[string]*hub
	active map[string]context.CancelFunc
	conns  map[string]net.Conn
}

// setConn stores/invalidates the hijacked attach connection used for stdin.
func (m *hubManager) setConn(id string, c net.Conn) {
	m.mu.Lock()
	m.conns[id] = c
	if c == nil {
		delete(m.conns, id)
	}
	m.mu.Unlock()
}

func (m *hubManager) connFor(id string) net.Conn {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.conns[id]
}

// attachLoop keeps an attach connection alive for a container and pushes its
// stdout/stderr into the hub. Detaches and reconnects transparently (attach
// connections die whenever a container restarts or Docker restarts).
func (m *hubManager) attachLoop(docker *client.Client, id string) {
	m.mu.Lock()
	if _, exists := m.active[id]; exists {
		m.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	m.active[id] = cancel
	h := m.hubs[id]
	if h == nil {
		h = newHub()
		m.hubs[id] = h
	}
	m.mu.Unlock()

	go func() {
		defer func() {
			m.mu.Lock()
			delete(m.active, id)
			m.mu.Unlock()
		}()
		name := containerName(id)
		for {
			if ctx.Err() != nil {
				return
			}
			hij, err := docker.ContainerAttach(ctx, name, container.AttachOptions{
				Stdin: true, Stdout: true, Stderr: true,
			})
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				time.Sleep(2 * time.Second)
				continue
			}
			m.setConn(id, hij.Conn)
			bw := &broadcastWriter{h: h}
			// Demultiplex the docker stream; container was created with Tty:false.
			if _, err := stdcopy.StdCopy(bw, bw, hij.Reader); err != nil && ctx.Err() == nil && err != io.EOF {
				log.Printf("attach %s ended: %v", id, err)
			}
			m.setConn(id, nil)
			hij.Conn.Close()
			if ctx.Err() != nil {
				return
			}
			time.Sleep(500 * time.Millisecond)
		}
	}()
}

func (m *hubManager) stop(id string) {
	m.mu.Lock()
	if cancel, ok := m.active[id]; ok {
		cancel()
	}
	m.mu.Unlock()
}

func (m *hubManager) hub(id string) *hub {
	m.mu.Lock()
	defer m.mu.Unlock()
	h := m.hubs[id]
	if h == nil {
		h = newHub()
		m.hubs[id] = h
	}
	return h
}

type broadcastWriter struct{ h *hub }

func (w *broadcastWriter) Write(p []byte) (int, error) {
	if k := bytes.IndexByte(p, 0); k >= 0 {
		p = p[:k] // trim NUL padding some images emit
	}
	w.h.broadcast(append([]byte(nil), p...))
	return len(p), nil
}



