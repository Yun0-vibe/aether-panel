#!/usr/bin/env bash
# One-time Codespace setup: deps + daemon build.
set -e

echo "==> installing panel deps"
npm install --prefix panel --no-audit --no-fund
npm install --prefix panel/client --no-audit --no-fund

echo "==> building daemon"
cd daemon && go mod download && go build -o bin/daemon . && cd ..

echo "==> done. Run: bash scripts/dev.sh"
