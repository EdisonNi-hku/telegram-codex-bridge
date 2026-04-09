# Feishu Install Strategy

Use this exact order. Do not improvise unless the normal path fails.

Resolve stable paths first:

```bash
SKILL_ROOT="${CODEX_HOME:-$HOME/.codex}/skills/feishu-codex-linker"
INSTALL_SCRIPT="$SKILL_ROOT/scripts/install-bridge-from-github.sh"
CTB_BIN="${HOME}/.local/share/codex-telegram-bridge/bin/ctb"
CTB="$(command -v ctb 2>/dev/null || true)"
if [[ -z "$CTB" && -x "$CTB_BIN" ]]; then
  CTB="$CTB_BIN"
fi
```

## 0. Language

Choose the user-facing language from the user's recent messages.

Rules:

- if the user is mainly writing in Chinese, default to Chinese
- if the user is mainly writing in English, default to English
- if mixed but the current request is Chinese, use Chinese

Suggested one-liners:

- Chinese: `我默认用中文；想切英文直接说。`
- English: `I'll use English by default; say so if you want Chinese.`

## 1. Precheck

Check:

- `codex --version`
- `codex login status`
- `node -v`
- `command -v ctb`
- `$CTB_BIN`

If the bridge is already installed, use:

```bash
"$CTB" status
"$CTB" doctor
```

Do not reinstall just because the user said "install" again. Decide whether this is install, repair, update, or rebind.

## 2. Decide

Choose exactly one mode before acting:

- `install`: bridge not installed
- `repair`: bridge installed but unhealthy and likely recoverable without replacing everything
- `update`: installed code is stale or packaging is broken and the normal update path is clean
- `rebind`: authorization must be reset or the user explicitly wants a different Feishu account

Decision order:

1. explicit rebind request wins
2. no installed bridge means install
3. installed bridge with `ready` or `awaiting_authorization` means do not reinstall
4. installed bridge with targeted operational problems means repair first
5. use update only when repair points to stale installed code or release drift

## 3. Required Feishu Console Checklist

Before debugging runtime behavior, verify this whole list in the Feishu app console:

- app type is enterprise self-built app
- bot ability is enabled
- permission `im:message.p2p_msg:readonly` is enabled
- long connection is enabled
- event subscription includes `im.message.receive_v1`
- card callback includes `card.action.trigger`
- latest app version has been published after any permission/event/callback change

This checklist exists because the current Feishu pack depends on two separate ingress paths:

- text messages come from `im.message.receive_v1`
- interactive button clicks come from `card.action.trigger`

Text working does not prove card callbacks work.
Card rendering does not prove button callbacks work.

## 4. Install

If the bridge is not installed and credentials are available, use the bundled script:

```bash
bash "$INSTALL_SCRIPT" --pack feishu --feishu-app-id '<app_id>' --feishu-app-secret '<app_secret>' --project-scan-roots '<path1:path2:path3>'
```

If credentials are missing, ask only for:

1. App ID
2. App Secret

## 5. Repair / Update / Rebind

Default repair sequence:

```bash
"$CTB" status
"$CTB" doctor
"$CTB" restart
```

If code is stale or the installed archive is missing Feishu runtime bits:

```bash
"$CTB" update
"$CTB" restart
```

For a rebind:

```bash
"$CTB" authorize clear
"$CTB" authorize pending
"$CTB" authorize pending --latest
```

If `ctb authorize ...` fails because the state store is locked, treat it as a local runtime/admin coordination issue. Do not send the user back into Feishu console debugging.

## 6. Smoke Test Contract

Do not declare success until this exact sequence passes:

1. send a private text like `hi` to the bot
2. if authorization is pending, inspect with:

```bash
"$CTB" authorize pending
"$CTB" authorize pending --latest
```

3. bind the user if needed
4. verify `/status`
5. verify `/new` renders the project picker card
6. click one project-card button and confirm the callback completes

For the current implementation, setup is incomplete until both the text path and the card callback path are proven.

## 7. Failure Patterns

### No reply after private message

Check, in this order:

- bot ability
- `im:message.p2p_msg:readonly`
- long connection
- `im.message.receive_v1`
- published version
- another service using the same Feishu app and consuming events first

One known conflict is OpenClaw using the same app credentials.

### Reply says the server is not bound to a Feishu account

This means text ingress works but authorization is still pending.
Use `ctb authorize pending` instead of reinstalling.

### `/status` works but button click fails

Treat this as card callback path failure first.

Primary checks:

- `card.action.trigger` is configured
- latest app version was published after enabling it

Known symptom:

- Feishu error code `200340`

For the current pack, `200340` should be treated as "card callback access/config not effective" until proven otherwise.

### Another bot or service seems to be responding instead

Assume shared-app contention first.
Do not keep changing bridge config while another long-connection consumer is still attached to the same Feishu app.
