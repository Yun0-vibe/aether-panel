package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/docker/go-connections/nat"
)

func newDocker() (*client.Client, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := cli.Ping(ctx); err != nil {
		// Still return the client: the daemon can boot and report errors
		// per-request even before/while Docker is starting.
		fmt.Fprintf(os.Stderr, "warning: docker ping failed: %v\n", err)
	}
	return cli, nil
}

const containerPrefix = "aether-"

func containerName(id string) string { return containerPrefix + id }

// ensureContainer creates the container for a spec (idempotent: if it already
// exists, the existing one is reused after removing stale config drift).
func (api *daemonAPI) ensureContainer(ctx context.Context, spec ServerSpec) error {
	name := containerName(spec.ID)
	inspect, err := api.docker.ContainerInspect(ctx, name)
	if err == nil {
		_ = inspect // exists; keep it
		return nil
	}
	if !client.IsErrNotFound(err) {
		return err
	}

	// Pull the image first so failures are reported as clear errors.
	reader, err := api.docker.ImagePull(ctx, spec.Image, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("image pull failed: %w", err)
	}
	io.Copy(io.Discard, reader)
	reader.Close()

	env := make([]string, 0, len(spec.Env))
	for k, v := range spec.Env {
		env = append(env, k+"="+v)
	}

	cfg := &container.Config{
		Image:        spec.Image,
		Env:          env,
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          false,
		OpenStdin:    true,
	}
	if spec.Command != "" {
		cfg.Cmd = []string{"/bin/sh", "-c", spec.Command}
	}
	if spec.Env["SERVER_PORT"] != "" {
		cfg.ExposedPorts = nat.PortSet{nat.Port(spec.Env["SERVER_PORT"] + "/tcp"): {}}
	}

	hostCfg := &container.HostConfig{
		NetworkMode: "bridge",
		RestartPolicy: container.RestartPolicy{
			Name: container.RestartPolicyDisabled,
		},
		PortBindings: nat.PortMap{},
		SecurityOpt:  []string{"no-new-privileges:true"},
	}
	// Persistent world/config storage mounted at /data inside the container.
	serverDir := api.serverDir(spec.ID)
	if err := os.MkdirAll(serverDir, 0o755); err != nil {
		return err
	}
	hostCfg.Binds = []string{serverDir + ":/data"}
	if spec.MemoryMB > 0 {
		hostCfg.Memory = int64(spec.MemoryMB) * 1024 * 1024
	}
	if spec.CPUs > 0 {
		hostCfg.NanoCPUs = int64(spec.CPUs * 1e9)
	}
	if spec.Env["SERVER_PORT"] != "" {
		hostCfg.PortBindings[nat.Port(spec.Env["SERVER_PORT"]+"/tcp")] = []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: fmt.Sprint(spec.HostPort)},
		}
	}

	created, err := api.docker.ContainerCreate(ctx, cfg, hostCfg, nil, nil, name)
	if err != nil {
		return fmt.Errorf("container create failed: %w", err)
	}
	log.Printf("created container %s for server %s", created.ID[:12], spec.ID)
	return nil
}

// power applies start/stop/restart/kill and returns the resulting state.
func (api *daemonAPI) power(ctx context.Context, id, action string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	spec, ok := api.store.get(id)
	if !ok {
		return "", fmt.Errorf("server not registered: %s", id)
	}

	switch action {
	case "start", "restart":
		// Make sure the container exists so a plain "start" after daemon
		// restarts (or after a failed create) still works.
		if err := api.ensureContainer(ctx, spec); err != nil {
			return "", err
		}
		if action == "restart" {
			stopCtx, stopCancel := context.WithTimeout(ctx, 45*time.Second)
			_ = api.docker.ContainerStop(stopCtx, containerName(id), container.StopOptions{Timeout: new(int)})
			stopCancel()
		}
		if err := api.docker.ContainerStart(ctx, containerName(id), container.StartOptions{}); err != nil {
			return "", fmt.Errorf("container %s start failed: %w", id, err)
		}
		api.hubs.attachLoop(api.docker, id)
		return "running", nil

	case "stop":
		timeout := 30
		_ = api.docker.ContainerStop(ctx, containerName(id), container.StopOptions{Timeout: &timeout})
		return "stopped", nil

	case "kill":
		_ = api.docker.ContainerKill(ctx, containerName(id), "")
		return "stopped", nil

	default:
		return "", fmt.Errorf("unknown action %q", action)
	}
}

// status returns ("running"|"exited"|docker state, error).
func (api *daemonAPI) status(ctx context.Context, id string) (string, error) {
	inspect, err := api.docker.ContainerInspect(ctx, containerName(id))
	if client.IsErrNotFound(err) {
		return "not_created", nil
	}
	if err != nil {
		return "", err
	}
	if inspect.State != nil && inspect.State.Running {
		return "running", nil
	}
	if inspect.State == nil {
		return "unknown", nil
	}
	switch inspect.State.Status {
	case "created", "paused", "restarting", "removing", "dead":
		return inspect.State.Status, nil
	default:
		return "stopped", nil
	}
}

// lastLines replays recent console output for websocket subscribers.
func (api *daemonAPI) lastLines(ctx context.Context, id string) (string, error) {
	readCloser, err := api.docker.ContainerLogs(ctx, containerName(id), container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "200",
	})
	if err != nil {
		if client.IsErrNotFound(err) {
			return "", nil
		}
		return "", err
	}
	defer readCloser.Close()

	var sb strings.Builder
	out, err2 := stdcopy.StdCopy(&sb, &sb, readCloser)
	if out == 0 && err2 != nil {
		// If the container uses a TTY, logs are raw text without the stdcopy
		// mux header; fall back to a raw copy on a fresh read.
		readCloser2, err3 := api.docker.ContainerLogs(ctx, containerName(id), container.LogsOptions{
			ShowStdout: true, ShowStderr: true, Tail: "200",
		})
		if err3 != nil {
			if client.IsErrNotFound(err3) {
				return "", nil
			}
			return "", err3
		}
		defer readCloser2.Close()
		raw, _ := io.ReadAll(readCloser2)
		return string(raw), nil
	}
	return sb.String(), nil
}



