#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=${CTB_WEB_PREVIEW_ENV:-"$HOME/.config/codex-telegram-bridge/web-preview.env"}
STATE_DIR=${CTB_WEB_PREVIEW_STATE_DIR:-"$HOME/.local/state/codex-telegram-bridge/web-preview"}
LOG_DIR="$STATE_DIR/logs"

secret_hex() {
  python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
}

ensure_env_file() {
  mkdir -p "$(dirname "$ENV_FILE")" "$STATE_DIR" "$LOG_DIR"
  umask 077
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

has_key() {
  grep -Eq "^$1=" "$ENV_FILE"
}

append_key() {
  printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
}

ensure_key() {
  local key=$1 value=$2
  if ! has_key "$key"; then
    append_key "$key" "$value"
  fi
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

pid_alive() {
  local pid_file=$1
  [[ -s "$pid_file" ]] || return 1
  local pid
  pid=$(cat "$pid_file")
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

port_busy() {
  local port=$1
  ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"
}

wait_for_port() {
  local port=$1 name=$2
  for _ in {1..60}; do
    if port_busy "$port"; then
      return 0
    fi
    sleep 0.25
  done
  echo "ERROR: $name did not listen on 127.0.0.1:$port in time" >&2
  return 1
}

start_readonly() {
  local pid_file="$STATE_DIR/readonly.pid"
  if pid_alive "$pid_file"; then
    echo "readonly app already running (pid $(cat "$pid_file"))"
    return
  fi
  rm -f "$pid_file"
  if port_busy "$CTB_WEB_READONLY_PORT"; then
    echo "ERROR: port $CTB_WEB_READONLY_PORT is already in use; not starting readonly app" >&2
    return 1
  fi
  (
    cd "$REPO_ROOT"
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
    if [[ "${CTB_WEB_USE_DIST:-0}" == "1" ]]; then
      if [[ ! -f dist/cli.js ]]; then
        echo "ERROR: CTB_WEB_USE_DIST=1 but dist/cli.js is missing" >&2
        exit 1
      fi
      exec node dist/cli.js web readonly --platform "${CTB_WEB_READONLY_PLATFORM:-feishu}" --port "${CTB_WEB_READONLY_PORT:-45682}"
    fi
    exec node --import tsx src/cli.ts web readonly --platform "${CTB_WEB_READONLY_PLATFORM:-feishu}" --port "${CTB_WEB_READONLY_PORT:-45682}"
  ) > "$LOG_DIR/readonly.log" 2>&1 &
  echo $! > "$pid_file"
  wait_for_port "$CTB_WEB_READONLY_PORT" "readonly app"
  echo "started readonly app (pid $(cat "$pid_file"))"
}

use_live_upstream() {
  if port_busy "$CTB_WEB_LIVE_PORT"; then
    echo "using live bridge Web Chat upstream on 127.0.0.1:$CTB_WEB_LIVE_PORT"
    return
  fi
  echo "ERROR: live bridge Web Chat is not listening on 127.0.0.1:$CTB_WEB_LIVE_PORT" >&2
  echo "Start or restart the managed bridge service with CTB_WEB_LIVE_ENABLED=1, CTB_WEB_LIVE_PORT=$CTB_WEB_LIVE_PORT, and CTB_WEB_READONLY_TOKEN set." >&2
  return 1
}

start_proxy() {
  local pid_file="$STATE_DIR/proxy.pid"
  if pid_alive "$pid_file"; then
    echo "cookie proxy already running (pid $(cat "$pid_file"))"
    return
  fi
  rm -f "$pid_file"
  if port_busy "$PROXY_PORT"; then
    echo "ERROR: port $PROXY_PORT is already in use; not starting cookie proxy" >&2
    return 1
  fi
  (
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
    exec python3 "$REPO_ROOT/scripts/web-owner-cookie-proxy.py"
  ) > "$LOG_DIR/proxy.log" 2>&1 &
  echo $! > "$pid_file"
  wait_for_port "$PROXY_PORT" "cookie proxy"
  echo "started cookie proxy (pid $(cat "$pid_file"))"
}

start_cloudflared() {
  local pid_file="$STATE_DIR/cloudflared.pid"
  if pid_alive "$pid_file"; then
    echo "cloudflared tunnel already running (pid $(cat "$pid_file"))"
    return
  fi
  rm -f "$pid_file"
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "ERROR: cloudflared not found in PATH" >&2
    return 1
  fi
  if [[ ! -f "$CTB_WEB_CLOUDFLARED_CONFIG" ]]; then
    echo "ERROR: cloudflared config not found: $CTB_WEB_CLOUDFLARED_CONFIG" >&2
    return 1
  fi
  (
    exec cloudflared tunnel --config "$CTB_WEB_CLOUDFLARED_CONFIG" run "$CTB_WEB_CLOUDFLARED_TUNNEL"
  ) > "$LOG_DIR/cloudflared.log" 2>&1 &
  echo $! > "$pid_file"
  echo "started cloudflared tunnel '$CTB_WEB_CLOUDFLARED_TUNNEL' (pid $(cat "$pid_file"))"
}

ensure_env_file
ensure_key CTB_WEB_READONLY_PORT 45682
ensure_key CTB_WEB_LIVE_PORT 45682
ensure_key CTB_WEB_LIVE_HOST 127.0.0.1
ensure_key PROXY_PORT 45683
ensure_key CTB_WEB_PREVIEW_MODE readonly
ensure_key CTB_WEB_READONLY_PLATFORM feishu
ensure_key CTB_WEB_PUBLIC_URL https://codex.guicheng.xyz
ensure_key CTB_WEB_CLOUDFLARED_CONFIG "$HOME/.cloudflared/codex-console.yml"
ensure_key CTB_WEB_CLOUDFLARED_TUNNEL codex-console
ensure_key CTB_WEB_CLOUDFLARED_READY_URL http://127.0.0.1:20242/ready
ensure_key CTB_WEB_READONLY_TOKEN "$(secret_hex)"
ensure_key CTB_WEB_SESSION_SECRET "$(secret_hex)"
if ! has_key CTB_WEB_PREVIEW_PASS && ! has_key CTB_WEB_BASIC_PASS; then
  append_key CTB_WEB_PREVIEW_PASS "$(secret_hex)"
fi
if grep -Eq "^CTB_WEB_PREVIEW_MODE=live$" "$ENV_FILE"; then
  ensure_key CTB_WEB_LIVE_ENABLED 1
fi
load_env
if ! has_key UPSTREAM; then
  if [[ "${CTB_WEB_PREVIEW_MODE:-readonly}" == "live" ]]; then
    append_key UPSTREAM "http://127.0.0.1:${CTB_WEB_LIVE_PORT:-${CTB_WEB_READONLY_PORT:-45682}}"
  else
    append_key UPSTREAM "http://127.0.0.1:${CTB_WEB_READONLY_PORT:-45682}"
  fi
  load_env
fi
chmod 600 "$ENV_FILE"

: "${CTB_WEB_READONLY_PORT:=45682}"
: "${CTB_WEB_LIVE_PORT:=$CTB_WEB_READONLY_PORT}"
: "${CTB_WEB_PREVIEW_MODE:=readonly}"
: "${PROXY_PORT:=45683}"
: "${CTB_WEB_PUBLIC_URL:=https://codex.guicheng.xyz}"
: "${CTB_WEB_CLOUDFLARED_CONFIG:=$HOME/.cloudflared/codex-console.yml}"
: "${CTB_WEB_CLOUDFLARED_TUNNEL:=codex-console}"

case "$CTB_WEB_PREVIEW_MODE" in
  live)
    use_live_upstream
    ;;
  readonly)
    start_readonly
    ;;
  *)
    echo "ERROR: CTB_WEB_PREVIEW_MODE must be readonly or live" >&2
    exit 1
    ;;
esac
start_proxy
start_cloudflared

echo
echo "Owner preview URL: $CTB_WEB_PUBLIC_URL"
echo "Preview mode: $CTB_WEB_PREVIEW_MODE"
echo "Password location: $ENV_FILE (CTB_WEB_PREVIEW_PASS or CTB_WEB_BASIC_PASS)"
echo "State/logs: $STATE_DIR"
echo "Run smoke: $REPO_ROOT/scripts/web-preview-smoke.sh"
