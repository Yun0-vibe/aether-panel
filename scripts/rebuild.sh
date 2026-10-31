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
# better-sqlite3 ships a native binding compiled/downloaded by its install
# script — --ignore-scripts skips it, so bootting crashes with
# "Could not locate the bindings file". Rebuild just that package.
(cd panel && npm rebuild better-sqlite3 2>&1 | tail -2)

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
  echo "==> stopping any previous panel/daemon processes"
  pkill -f "node panel/dist/main.js" 2>/dev/null || true
  pkill -f "daemon/bin/daemon" 2>/dev/null || true
  sleep 1
  echo "==> starting (background processes, logs in ~/.aether/logs)"
  NO_DOCKER_WARN=1 AETHER_TOKEN="${AETHER_NODE_TOKEN}" AETHER_PORT=8080 \
    AETHER_DATA_DIR="$HOME/.aether/data" nohup daemon/bin/daemon \
    > "$HOME/.aether/logs/daemon.log" 2>&1 &
  AETHER_PANEL_PORT="${AETHER_PANEL_PORT:-3000}" AETHER_DB_FILE="$HOME/.aether/panel.db" \
    nohup node panel/dist/main.js > "$HOME/.aether/logs/panel.log" 2>&1 &
  sleep 2
  echo "build: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  PANEL_URL="http://127.0.0.1:${AETHER_PANEL_PORT:-3000}/healthz"
  ok=""
  for _ in 1 2 3 4 5 6 7 8; do
    if curl -fsS "$PANEL_URL" > /dev/null 2>&1; then ok=1; break; fi
    sleep 1
  done
  echo "panel pid: $(pgrep -f "node panel/dist/main.js" 2>/dev/null || echo 'NOT RUNNING')"
  if [ -n "$ok" ]; then
    echo "panel: healthy on port ${AETHER_PANEL_PORT:-3000}"
  else
    echo "panel: FAILED to boot — last log lines:"
    tail -n 12 "$HOME/.aether/logs/panel.log" || true
  fi
  echo
  echo "open your panel, register the admin account, done."
else
  echo "BUILD OK - no errors:"
  echo "    daemon  -> daemon/bin/daemon"
  echo "    panel   -> panel/dist"
  echo "    client  -> panel/client/dist"
  echo "    run 'bash scripts/rebuild.sh --start' to launch without containers."
fi
