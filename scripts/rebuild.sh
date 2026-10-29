#!/usr/bin/env bash
# Aether Panel — clean rebuild WITHOUT any container involvement.
# Pure native toolchain: Node (JS/TS) + Go (daemon binary). Docker is NOT used here.
# Runs in Codespaces, on a VPS, or locally — panel :3000, daemon :8080.
#
#   bash scripts/rebuild.sh            # build everything
#   bash scripts/rebuild.sh --start    # build and launch (panel :3000, daemon :8080)
set -euo pipefail
cd "$(dirname "$0")/.."

RUN=0
[ "${1:-}" = "--start" ] && RUN=1
export CGO_ENABLED=0

echo "==> [1/3] panel build (Fastify API + SQLite)"
(cd panel && npm ci --ignore-scripts --no-audit --no-fund && npm run build)

echo "==> [2/3] client build (React UI)"
(cd panel/client && npm ci --ignore-scripts --no-audit --no-fund && npm run build)

echo "==> [3/3] Go daemon (native binary, no Docker)"
(cd daemon && go mod tidy && go build -trimpath -ldflags="-s -w" -o bin/daemon .)

echo "==> data dirs + env"
mkdir -p "$HOME/.aether/data/containers" "$HOME/.aether/logs"
if [ ! -f .env ]; then
  node -e 'console.log("AETHER_NODE_TOKEN=" + require("crypto").randomBytes(24).toString("hex"))' > .env
  echo "AETHER_PANEL_PORT=3000" >> .env
  echo "created .env with a fresh node token"
fi
# shellcheck disable=SC1091
. .env

if [ "$RUN" = 1 ]; then
  echo "==> starting (background processes, logs in ~/.aether/logs)"
  NO_DOCKER_WARN=1 AETHER_TOKEN="${AETHER_NODE_TOKEN}" AETHER_PORT=8080 \
    AETHER_DATA_DIR="$HOME/.aether/data" nohup daemon/bin/daemon \
    > "$HOME/.aether/logs/daemon.log" 2>&1 &
  AETHER_PANEL_PORT="${AETHER_PANEL_PORT:-3000}" AETHER_DB_FILE="$HOME/.aether/panel.db" \
    nohup node panel/dist/main.js > "$HOME/.aether/logs/panel.log" 2>&1 &
  sleep 2
  curl -fsS "http://127.0.0.1:${AETHER_PANEL_PORT:-3000}/healthz" 2>/dev/null \
    && echo "panel: healthy" || echo "panel: booting (check ~/.aether/logs/panel.log)"
  echo
  echo "open your panel, register the admin account, done."
else
  echo "BUILD OK - no errors:"
  echo "    daemon  -> daemon/bin/daemon"
  echo "    panel   -> panel/dist"
  echo "    client  -> panel/client/dist"
  echo "    run 'bash scripts/rebuild.sh --start' to launch without containers."
fi
