---
name: feishu-codex-linker
description: Install, configure, repair, update, or rebind the Codex Bridge core with the Feishu pack after the user installs this skill. Use when the user wants Codex to take over bridge setup with minimal user action, only interrupting for unavoidable external steps like providing a Feishu app id/app secret or messaging the Feishu bot once.
---

# Feishu Codex Linker

Use this skill when the user wants the bridge installed or repaired with the `feishu` pack.

Default language follows the user's recent messages. Keep the interaction short and action-oriented.

Before acting, read `references/install-strategy.md`.

The goal is not just "service up". The goal is "Feishu text ingress works, authorization binds, and interactive card callbacks work".

Do not stop after `ctb doctor` is green or `/status` replies once. For the current implementation, Feishu setup is only complete after both of these paths are proven:

- text ingress path: `im.message.receive_v1`
- card callback path: `card.action.trigger`

Resolve these first:

```bash
SKILL_ROOT="${CODEX_HOME:-$HOME/.codex}/skills/feishu-codex-linker"
INSTALL_SCRIPT="$SKILL_ROOT/scripts/install-bridge-from-github.sh"
CTB_BIN="${HOME}/.local/share/codex-telegram-bridge/bin/ctb"
```

Windows PowerShell equivalents:

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME "AppData\\Local" }
$skillRoot = Join-Path $codexHome "skills\\feishu-codex-linker"
$installScript = Join-Path $skillRoot "scripts\\install-bridge-from-github.ps1"
$ctbBin = Join-Path $localAppData "codex-telegram-bridge\\bin\\ctb.cmd"
```

For first install, use the bundled script:

```bash
bash "$INSTALL_SCRIPT" --pack feishu --feishu-app-id '<app_id>' --feishu-app-secret '<app_secret>' --project-scan-roots '<path1:path2:path3>'
```

On Windows:

```powershell
powershell -ExecutionPolicy Bypass -File $installScript -Pack feishu -FeishuAppId '<app_id>' -FeishuAppSecret '<app_secret>' -ProjectScanRoots '<path1;path2;path3>'
```

Rules:

- do as much as possible automatically
- detect before asking
- ask for one thing at a time
- use the bundled install script for first install
- use `ctb` for status, doctor, restart, update, authorize, and repair flows
- ask only for Feishu app credentials, Codex login, one project-root decision if needed, or one Feishu P2P message to the bot
- prefer `ctb status`, `ctb doctor`, `ctb restart`, and `ctb authorize ...` over reinstalling
- do not ask the user to run local shell commands you can run yourself
- do not declare success until readiness is healthy, authorization is bound, `/status` succeeds, `/new` renders, and one project-card button click succeeds

Required Feishu-side config for the current pack:

- enterprise self-built app
- bot ability enabled
- permission `im:message.p2p_msg:readonly`
- long connection enabled
- event subscription `im.message.receive_v1`
- card callback `card.action.trigger`
- publish the latest app version after changing permissions or events

Known operator traps:

- text reply working once does not prove card callbacks are configured
- `/new` rendering does not prove button callbacks are configured
- if text messages never reach the bridge, another consumer on the same Feishu app may be taking the events; OpenClaw is one known example
- if button clicks fail with `200340`, treat that as Feishu card callback access/config not effective, not as a project-picker bug
- if install came from an older GitHub archive, prefer repair/update against the current repo truth before deep debugging

Minimal finish flow:

1. Confirm install or repair state with `ctb status` and `ctb doctor`.
2. Confirm the Feishu app has the required config as one checklist, not one-by-one guesswork.
3. Ask the user to send one private message to the bot if authorization is pending.
4. Bind with `ctb authorize ...`.
5. Verify `/status`.
6. Verify `/new`.
7. Verify one project-card button click.

Failure interpretation:

- no response to private message:
  check bot ability, `im:message.p2p_msg:readonly`, long connection, `im.message.receive_v1`, published version, and shared-app contention
- private message works but button click fails:
  check `card.action.trigger` and publish the latest app version again
- reply says account is not bound:
  continue with `ctb authorize pending` instead of reinstalling
- `ctb authorize ...` hits a state-store lock:
  treat that as a local service/admin coordination problem, not a Feishu permission problem

Credential prompt shape:

1. 打开飞书开放平台应用后台。
2. 找到这个自建应用的 `App ID` 和 `App Secret`。
3. 发给我。

Repair path:

```bash
"${CTB:-$CTB_BIN}" status
"${CTB:-$CTB_BIN}" doctor
"${CTB:-$CTB_BIN}" restart
```

Update path:

```bash
"${CTB:-$CTB_BIN}" update
"${CTB:-$CTB_BIN}" restart
```

Rebind path:

```bash
"${CTB:-$CTB_BIN}" authorize clear
"${CTB:-$CTB_BIN}" authorize pending
"${CTB:-$CTB_BIN}" authorize pending --latest
```
