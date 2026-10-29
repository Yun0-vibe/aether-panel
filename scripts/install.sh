#!/usr/bin/env bash
# Aether Panel — one-command installer
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Yun0-vibe/aether-panel/main/scripts/install.sh)"
#
# Works in a fresh GitHub Codespace, a blank Linux box or VPS with Node >= 20
# and Go >= 1.25 installed. Builds both components, generates a node token and
# runs everything with nohup.

set -euo pipefail

REPO="${AETHER_REPO:-https://github.com/Yun0-vibe/aether-panel.git}"
DIR="${AETHER_DIR:-$HOME/aether-panel}"
PANEL_PORT="${AETHER_PANEL_PORT:-3000}"
DAEMON_PORT="${AETHER_DAEMON_PORT:-8080}"

log() { printf '\n\033[1;36m==>\033[0m \033[1m%s\033[0m\n' "$*"; }

command -v node >/dev/null || { echo "node >= 20 is required (https://nodejs.org)"; exit 1; }
command -v git  >/dev/null || { echo "git is required"; exit 1; }

if [ ! -d "$DIR/.git" ]; then
  log "Cloning $REPO into $DIR"
  git clone --depth=1 "$REPO" "$DIR"
fi
cd "$DIR"

log "Installing panel dependencies"
npm install --prefix panel --no-audit --no-fund
npm install --prefix panel/client --no-audit --no-fund

log "Building panel (API + client)"
npm run build --prefix panel
npm run build --prefix panel/client

if [ ! -f .env ]; then
  TOKEN="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
  cat > .env <<ENV
# shared secret between panel and node daemon
AETHER_NODE_TOKEN=$TOKEN
AETHER_PANEL_PORT=$PANEL_PORT
# set to true to allow public user registration after the admin account exists
AETHER_OPEN_REGISTER=false
AETHER_KEEP_BACKUPS=10
ENV
  chmod 600 .env
fi
# shellcheck disable=SC1091
. .env

log "Building daemon"
if command -v go >/dev/null; then
  (cd daemon && go mod tidy && go build -o bin/daemon .)
else
  echo "!! Go is not installed."
  if command -v docker >/dev/null; then
    echo "   Falling back to the Docker image for the daemon."
    (cd daemon && docker build -t aether-daemon .)
    docker rm -f aether-daemon 2>/dev/null || true
    docker run -d --name aether-daemon --restart unless-stopped \
      -p "$DAEMON_PORT:$DAEMON_PORT" \
      -e AETHER_TOKEN="$AETHER_NODE_TOKEN" -e AETHER_PORT="$DAEMON_PORT" \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v aether-config:/var/lib/aether/config -v aether-data:/var/lib/aether/data \
      aether-daemon
  else
    echo "   Install Go 1.25+ (https://go.dev/dl) and re-run this script."
    exit 1
  fi
fi

log "Starting services"
mkdir -p "$HOME/.aether/logs"
if ! docker inspect aether-daemon >/dev/null 2>&1; then
  AETHER_TOKEN="$AETHER_NODE_TOKEN" AETHER_PORT="$DAEMON_PORT" \
    AETHER_DATA_DIR="$HOME/.aether/data" nohup daemon/bin/daemon \
    > "$HOME/.aether/logs/daemon.log" 2>&1 &
fi
AETHER_PANEL_PORT="$PANEL_PORT" AETHER_DB_FILE="$HOME/.aether/panel.db" \
  nohup node panel/dist/main.js > "$HOME/.aether/logs/panel.log" 2>&1 &

sleep 2
if curl -fsS "http://127.0.0.1:$PANEL_PORT/api/auth/me" >/dev/null 2>&1; then ME=ok; else ME=starting; fi

cat <<DONE

  \033[1;32mAether Panel is up.\033[0m

  Panel  : http://localhost:$PANEL_PORT   (health: $ME)
  Daemon : http://localhost:$DAEMON_PORT
  Logs   : $HOME/.aether/logs/{panel,daemon}.log
  Data   : $HOME/.aether  (.env holds AETHER_NODE_TOKEN)

  Next steps:
   1. Open the panel and register — the first account becomes admin.
   2. Admin → Nodes:
        host localhost, daemonPort $DAEMON_PORT, token = AETHER_NODE_TOKEN from .env
   3. Admin → Servers: create a server, e.g. Minecraft (image: itzg/minecraft-server,
      env: EULA=TRUE SERVER_PORT=25565, port 25565).

  Codespaces note: port $PANEL_PORT is probed automatically; if this is a codespace,
  check the Ports panel and open the forwarded 3000 URL in your browser.
DONE
