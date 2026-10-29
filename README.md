# Aether Panel

A Pterodactyl/Multicraft-style multi-tenant game server panel.

## Architecture

```
┌────────────────────┐        ┌──────────────────────┐
│  panel/ (TS)       │        │  daemon/ (Go)        │
│  Fastify + SQLite  │──HTTP──▶│  runs on each node   │
│  React + WS proxy  │        │  manages Docker      │
└────────────────────┘        └──────────────────────┘
         │
   ┌─────┴─────┐
   │   users   │  admin ─ manages nodes/users/servers
   │  (browser)│  user  ─ owns servers, console, power
   └───────────┘
```

- **panel/** — Fastify API (Node), SQLite storage, React frontend with websocket console proxy.
- **daemon/** — Go agent running on every game node. Talks to the local Docker daemon, runs each
  game server in its own container, streams stdin/stdout over websocket.

## API contract

### Panel → Browser (`/api/*`)

Auth (cookie session, JWT-signed):
- `POST /api/auth/register` `{email, password}` — allowed while zero users exist (bootstrap admin),
  afterwards disabled unless `OPEN_REGISTER=true`.
- `POST /api/auth/login` `{email, password}` → sets `ae_session` httpOnly cookie
- `POST /api/auth/logout`
- `GET  /api/auth/me` → `{user}`

User (owns servers):
- `GET  /api/servers` → servers owned by session user
- `GET  /api/servers/:id` → one server (ownership or admin)
- `POST /api/servers/:id/power` `{action: "start"|"stop"|"restart"|"kill"}` → proxied to daemon
- `WS   /api/servers/:id/console` → proxied websocket to daemon console

Admin only:
- `GET/POST/PATCH/DELETE /api/admin/users` `GET/POST/PATCH/DELETE /api/admin/users/:id`
- `GET/POST/PATCH/DELETE /api/admin/nodes` `{name, host, daemonPort, token}`
- `GET/POST/PATCH/DELETE /api/admin/servers` `{name, userId, nodeId, image, env, port, memoryMB, cpus}`

### Panel ↔ Daemon (`http://node:8080/v1/*`, `Authorization: Bearer <token>`)

- `POST   /v1/servers` `{id, image, env{}, hostPort, memoryMB, cpus, command, workdir, files}`
- `POST   /v1/servers/:id/power` `{action: "start"|"stop"|"restart"|"kill"}`
- `DELETE /v1/servers/:id`
- `GET    /v1/ws/:id` → upgrade to websocket; frames: `{"t":"out","d":"..."}` stdout, `{"t":"in","d":"cmd"}` stdin

## Development

```bash
# panel (api on :3000, client dev server on :5173)
cd panel && npm install && npm install --prefix client && npm run dev

# daemon (compiles everywhere; containers only run where Docker exists)
cd daemon && go build -o bin/daemon .
```

## Deploying a Linux node

1. Install Docker: `curl -fsSL https://get.docker.com | sh`
2. Create an admin user (first panel registration) and add a **node** in Admin → Nodes.
   Pick a token (or generate one) — it is the only thing the node needs.
3. On the node:
   ```bash
   cd daemon
   docker build -t aether-daemon .
   docker run -d --name aether-daemon --restart unless-stopped \
     --pid host -p 8080:8080 \
     -e AETHER_TOKEN=<token-from-panel> \
     -v /var/run/docker.sock:/var/run/docker.sock \
     -v daemon-config:/var/lib/aether/config \
     aether-daemon
   ```
   Or run the binary directly with the bundled `daemon.service` systemd unit
   (`AETHER_TOKEN=<token>`, `AETHER_CONFIG_DIR=/var/lib/aether/config`).
4. The node goes online automatically — create a server in Admin → Servers.

## Bootstrapping

Open the panel while the database has zero users → the first registration becomes `admin`.
Then create a **node** in Admin → store its `token`, run the daemon on the Linux node with
`AETHER_TOKEN=<token> AETHER_PORT=8080 ./daemon`. Then create **servers** assigned to users.
