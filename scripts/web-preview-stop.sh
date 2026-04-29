#!/usr/bin/env bash
set -euo pipefail

STATE_DIR=${CTB_WEB_PREVIEW_STATE_DIR:-"$HOME/.local/state/codex-telegram-bridge/web-preview"}
ENV_FILE=${CTB_WEB_PREVIEW_ENV:-"$HOME/.config/codex-telegram-bridge/web-preview.env"}

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
: "${CTB_WEB_CLOUDFLARED_TUNNEL:=codex-console}"

stop_pid_file() {
  local name=$1 pid_file=$2
  if [[ ! -s "$pid_file" ]]; then
    echo "$name: no pid file"
    return
  fi
  local pid
  pid=$(cat "$pid_file")
  if [[ ! "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "$name: not running"
    rm -f "$pid_file"
    return
  fi
  kill "$pid" 2>/dev/null || true
  for _ in {1..40}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      echo "$name: stopped"
      return
    fi
    sleep 0.25
  done
  kill -KILL "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  echo "$name: killed after timeout"
}

# Stop public ingress first, then proxy, then readonly app.
stop_pid_file cloudflared "$STATE_DIR/cloudflared.pid"
stop_pid_file proxy "$STATE_DIR/proxy.pid"
stop_pid_file readonly "$STATE_DIR/readonly.pid"

echo "Stop complete for managed preview pid files under $STATE_DIR."
echo "Unrelated cloudflared quick tunnels, including :8088 previews, are not touched."
