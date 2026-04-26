#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${CTB_WEB_PREVIEW_ENV:-"$HOME/.config/codex-telegram-bridge/web-preview.env"}
STATE_DIR=${CTB_WEB_PREVIEW_STATE_DIR:-"$HOME/.local/state/codex-telegram-bridge/web-preview"}
mkdir -p "$(dirname "$ENV_FILE")"
umask 077
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import secrets
import sys

path = Path(sys.argv[1])
updates = {
    "CTB_WEB_READONLY_TOKEN": secrets.token_hex(32),
    "CTB_WEB_SESSION_SECRET": secrets.token_hex(32),
    "CTB_WEB_PREVIEW_PASS": secrets.token_hex(32),
}
lines = path.read_text().splitlines() if path.exists() else []
seen = set()
out = []
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0]
    if key in updates:
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n")
PY
chmod 600 "$ENV_FILE"

echo "Rotated CTB_WEB_READONLY_TOKEN, CTB_WEB_SESSION_SECRET, and CTB_WEB_PREVIEW_PASS in $ENV_FILE."
echo "New secrets were not printed. Restart the preview to apply them:"
echo "  scripts/web-preview-stop.sh && scripts/web-preview-start.sh"
if [[ -d "$STATE_DIR" ]] && find "$STATE_DIR" -maxdepth 1 -name '*.pid' -size +0c | grep -q .; then
  echo "Managed pid files are present under $STATE_DIR; current processes keep old secrets until restart."
fi
