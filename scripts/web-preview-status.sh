#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${CTB_WEB_PREVIEW_ENV:-"$HOME/.config/codex-telegram-bridge/web-preview.env"}
STATE_DIR=${CTB_WEB_PREVIEW_STATE_DIR:-"$HOME/.local/state/codex-telegram-bridge/web-preview"}
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
: "${CTB_WEB_READONLY_PORT:=45682}"
: "${PROXY_PORT:=45683}"
: "${CTB_WEB_PUBLIC_URL:=https://codex.guicheng.xyz}"
: "${CTB_WEB_CLOUDFLARED_TUNNEL:=codex-console}"
: "${CTB_WEB_CLOUDFLARED_READY_URL:=http://127.0.0.1:20242/ready}"

pid_status() {
  local name=$1 pid_file=$2
  if [[ -s "$pid_file" ]]; then
    local pid
    pid=$(cat "$pid_file")
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      echo "$name: running (pid $pid)"
      return
    fi
    echo "$name: stale pid file ($pid_file)"
    return
  fi
  echo "$name: no managed pid file"
}

port_status() {
  local name=$1 port=$2
  if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"; then
    echo "$name port: listening on $port"
  else
    echo "$name port: not listening on $port"
  fi
}

echo "Env file: $ENV_FILE"
echo "State dir: $STATE_DIR"
echo "Public URL: $CTB_WEB_PUBLIC_URL"
echo
pid_status readonly "$STATE_DIR/readonly.pid"
pid_status proxy "$STATE_DIR/proxy.pid"
pid_status cloudflared "$STATE_DIR/cloudflared.pid"
echo
port_status readonly "$CTB_WEB_READONLY_PORT"
port_status proxy "$PROXY_PORT"
echo
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 3 "http://127.0.0.1:${PROXY_PORT}/healthz" >/dev/null; then
    echo "proxy healthz: ok"
  else
    echo "proxy healthz: unavailable"
  fi
  if curl -fsS --max-time 3 "$CTB_WEB_CLOUDFLARED_READY_URL" >/dev/null 2>&1; then
    echo "cloudflared ready endpoint: ok ($CTB_WEB_CLOUDFLARED_READY_URL)"
  else
    echo "cloudflared ready endpoint: unavailable ($CTB_WEB_CLOUDFLARED_READY_URL)"
  fi
else
  echo "curl: unavailable"
fi
if pgrep -af "[c]loudflared .*run ${CTB_WEB_CLOUDFLARED_TUNNEL}" >/dev/null 2>&1; then
  echo "cloudflared named tunnel process: present ($CTB_WEB_CLOUDFLARED_TUNNEL)"
else
  echo "cloudflared named tunnel process: not found ($CTB_WEB_CLOUDFLARED_TUNNEL)"
fi
