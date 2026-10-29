#!/usr/bin/env bash
# Start the full stack for local / Codespace development:
#   - Go daemon (manages Docker containers on :8080)
#   - Panel API (:3000) — first visit, register once; the panel URL is forwarded by Codespaces.
#   - Vite client (:5173 with hot reload; /api proxied to :3000)
set -e
cd "$(dirname "$0")/.."

export AETHER_TOKEN="${AETHER_TOKEN:-dev-codespace-token}"
export AETHER_PANEL_PORT="${AETHER_PANEL_PORT:-3000}"

echo "==> starting daemon on :8080"
(cd daemon && ./bin/daemon &) || echo "daemon build missing? run: cd daemon && go build -o bin/daemon ."

echo "==> starting panel on :3000"
(cd panel && npm run dev &) > panel/.dev.log 2>&1

echo "==> dev tip: http://localhost:5173 during UI development."
echo "==> in Codespaces, port 3000 is auto-forwarded and opened in your browser."
wait
