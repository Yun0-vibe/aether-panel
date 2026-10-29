# Aether Panel — clean rebuild WITHOUT containers, on Windows.
#   powershell -File scripts\rebuild.ps1 [-Start]
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:CGO_ENABLED = "0"

Write-Host "==> [1/4] panel build" -ForegroundColor Cyan
Push-Location panel
  npm ci --no-audit --no-fund
  npm run build
Pop-Location

Write-Host "==> [2/4] client build" -ForegroundColor Cyan
Push-Location panel\client
  npm ci --no-audit --no-fund
  npm run build
Pop-Location

Write-Host "==> [3/4] Go daemon (native binary, no Docker)" -ForegroundColor Cyan
Push-Location daemon
  go mod tidy
  go build -trimpath -ldflags="-s -w" -o bin/daemon.exe .
Pop-Location

Write-Host "==> [4/4] dirs + env" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$HOME\.aether\data\containers", "$HOME\.aether\logs" | Out-Null
if (-not (Test-Path "$root\.env")) {
  $token = [Convert]::ToHexString((1..12 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
  "AETHER_NODE_TOKEN=$($token -replace '\s','')" | Set-Content "$root\.env"
  "AETHER_PANEL_PORT=3000" | Add-Content "$root\.env"
  Write-Host "created .env with a fresh node token"
}

if ($args -contains "-Start") {
  Write-Host "==> starting (background processes, logs in ~\.aether\logs)" -ForegroundColor Cyan
  Get-Content "$root\.env" | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item "env:$k" $v }
  $env:AETHER_TOKEN = $env:AETHER_NODE_TOKEN
  $env:AETHER_PORT = "8080"
  $env:AETHER_DATA_DIR = "$HOME\.aether\data"
  Start-Process -WindowStyle Hidden daemon\bin\daemon.exe -RedirectStandardOutput "$HOME\.aether\logs\daemon.log" -RedirectStandardError "$HOME\.aether\logs\daemon.err.log"
  $env:AETHER_PANEL_PORT = $env:AETHER_PANEL_PORT ?? "3000"
  $env:AETHER_DB_FILE = "$HOME\.aether\panel.db"
  Start-Process -WindowStyle Hidden node -ArgumentList "panel\dist\main.js" -RedirectStandardOutput "$HOME\.aether\logs\panel.log" -RedirectStandardError "$HOME\.aether\logs\panel.err.log"
  Start-Sleep 2
  Write-Host "panel: http://localhost:$($env:AETHER_PANEL_PORT)   daemon: :8080"
} else {
  Write-Host "dry build complete:" -ForegroundColor Green
  Write-Host "    daemon  -> daemon\bin\daemon.exe"
  Write-Host "    panel   -> panel\dist"
  Write-Host "    client  -> panel\client\dist"
  Write-Host "    run 'powershell -File scripts\rebuild.ps1 -Start' to launch."
}
