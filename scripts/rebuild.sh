#!/usr/bin/env bash
# Aether Panel — clean rebuild WITHOUT any container involvement.
# Pure native toolchain: Node (JS/TS) + Go (daemon binary). Docker is NOT used here.
#
#   bash scripts/rebuild.sh            # build everything
#   bash scripts/rebuild.sh --start    # build and run (panel :3000, daemon :8080)
#   bash scripts/rebuild.sh --run      # alias of --start
set -euo pipefail
cd "$(dirname "$0")/.."

RUN=0
[ "${1:-}" = "--start" ] || [ "${1:-}" = "--run" ] && RUN=1
export CGO_ENABLED=0

echo "==> [1/5] panel deps + production build"
npm ci --prefix panel --no-audit --no-fund
npm run build --prefix panel

echo "==> [2/5] client deps + production build"
npm ci --prefix panel/client --no-audit --no-fund
npm run build --prefix panel/client

echo "==> [3/5] Go daemon (native binary, no Docker)"
(cd daemon && go mod tidy && go build -trimpath -ldflags="-s -w" -o bin/daemon .)

echo "==> [4/5] daemon metadata + data dirs"
mkdir -p "$HOME/.aether/data/containers" "$HOME/.aether/logs"
if [ ! -f .env ]; then
  node -e 'console.log("AETHER_NODE_TOKEN=" + require("crypto").randomBytes(24).toString("hex"))' > .env
  echo "AETHER_PANEL_PORT=3000" >> .env
  echo "created .env with a fresh node token"
fi
# shellcheck disable=SC1091
. .env

if [ "$RUN" = 1 ]; then
  echo "==> [5/5] starting (nohup, logs in ~/.aether/logs)"
  NO_DOCKER_WARN=1 AETHER_TOKEN="${AETHER_NODE_TOKEN}" AETHER_PORT=8080 \
    AETHER_DATA_DIR="$HOME/.aether/data" nohup daemon/bin/daemon \
    > "$HOME/.aether/logs/daemon.log" 2>&1 &
  AETHER_PANEL_PORT="${AETHER_PANEL_PORT:-3000}" AETHER_DB_FILE="$HOME/.aether/panel.db" \
    nohup node panel/dist/main.js > "$HOME/.aether/logs/panel.log" 2>&1 &
  sleep 2
  curl -fsS "http://127.0.0.1:$(grep ^AETHER_PANEL_PORT .env | cut -d= -f2)/healthz" 2>/dev/null \
    && echo "panel: healthy" || echo "panel: booting (check ~/.aether/logs/panel.log)"
  echo
  echo "open your panel, register the admin account, done."
else
  echo "==> [5/5] dry build complete:"
  echo "    daemon  -> daemon/bin/daemon"
  echo "    panel   -> panel/dist"
  echo "    client  -> panel/client/dist"
  echo "    run 'bash scripts/rebuild.sh --start' to launch without containers."
fi
