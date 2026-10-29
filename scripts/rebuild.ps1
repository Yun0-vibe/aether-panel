# Aether Panel — clean rebuild WITHOUT containers, on Windows.
#   powershell -File scripts\rebuild.ps1        # build everything
#   powershell -File scripts\rebuild.ps1 -Start # build and launch (panel :3000, daemon :8080)
#
# Works on Windows PowerShell 5.1 and PowerShell 7+. No Docker, no container, no image pulls.
#
# NOTE on native modules: the panel uses better-sqlite3, whose installer tries to download
# prebuilt binaries from GitHub releases and falls back to compiling from C++ (node-gyp),
# which needs Visual Studio. `--ignore-scripts` skips that compile step; the npm tarball
# already bundles the prebuilt .node for every platform, so better-sqlite3 still loads
# at runtime. This keeps the rebuild error-free on Windows and on Codespace/Linux alike.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:CGO_ENABLED = "0"

# PS 5.1 does not abort on native exit codes — check them explicitly.
function Check([string]$what) {
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" }
}

try {
  Write-Host "==> [1/3] panel build (Fastify API + SQLite)" -ForegroundColor Cyan
  Push-Location "$root\panel"
    npm ci --ignore-scripts --no-audit --no-fund;   Check "npm ci (panel)"
    npm run build;                                  Check "panel build (tsc)"
  Pop-Location

  Write-Host "==> [2/3] client build (React UI)" -ForegroundColor Cyan
  Push-Location "$root\panel\client"
    npm ci --ignore-scripts --no-audit --no-fund;   Check "npm ci (client)"
    npm run build;                                  Check "client build (vite)"
  Pop-Location

  Write-Host "==> [3/3] Go daemon (native binary, no Docker)" -ForegroundColor Cyan
  Push-Location "$root\daemon"
    go mod tidy;                                    Check "go mod tidy"
    go build -trimpath -ldflags "-s -w" -o bin/daemon.exe .; Check "go build (daemon)"
  Pop-Location

  Write-Host "==> data dirs + env" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path "$HOME\.aether\data\containers", "$HOME\.aether\logs" | Out-Null
  if (-not (Test-Path "$root\.env")) {
    $token = -join (1..48 | ForEach-Object { '{0:x}' -f (Get-Random -Minimum 0 -Maximum 16) })
    "AETHER_NODE_TOKEN=$token" | Set-Content "$root\.env"
    "AETHER_PANEL_PORT=3000" | Add-Content "$root\.env"
    Write-Host "created .env with a fresh node token"
  }

  if ($args -contains "-Start") {
    Write-Host "==> starting (background processes, logs in ~\.aether\logs)" -ForegroundColor Cyan
    Get-Content "$root\.env" | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item "env:$k" $v }
    $env:AETHER_TOKEN = $env:AETHER_NODE_TOKEN
    $env:AETHER_PORT = "8080"
    $env:AETHER_DATA_DIR = "$HOME\.aether\data"
    $env:AETHER_PANEL_PORT = "3000"
    $env:AETHER_DB_FILE = "$HOME\.aether\panel.db"
    Start-Process -WindowStyle Hidden "$root\daemon\bin\daemon.exe" -WorkingDirectory $root -RedirectStandardOutput "$HOME\.aether\logs\daemon.log" -RedirectStandardError "$HOME\.aether\logs\daemon.err.log"
    Start-Process -WindowStyle Hidden node -WorkingDirectory $root -ArgumentList "$root\panel\dist\main.js" -RedirectStandardOutput "$HOME\.aether\logs\panel.log" -RedirectStandardError "$HOME\.aether\logs\panel.err.log"
    Start-Sleep 2
    Write-Host "panel: http://localhost:$($env:AETHER_PANEL_PORT)   daemon: :8080" -ForegroundColor Green
  } else {
    Write-Host "BUILD OK - no errors:" -ForegroundColor Green
    Write-Host "    daemon  -> daemon\bin\daemon.exe"
    Write-Host "    panel   -> panel\dist"
    Write-Host "    client  -> panel\client\dist"
    Write-Host "    run 'powershell -File scripts\rebuild.ps1 -Start' to launch."
  }
} catch {
  Pop-Location -ErrorAction SilentlyContinue
  Write-Host "BUILD FAILED: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
