<!-- docmeta
role: leaf
layer: 3
parent: docs/operations/README.md
summary: active owner runbook for the managed Codex Console Web preview on codex.guicheng.xyz
read_when:
  - operating the personal Codex Console Web owner preview
  - starting, stopping, checking, smoking, rotating, or rolling back the Web preview stack
skip_when:
  - changing Web product UI or adding multi-user/action controls
source_of_truth:
  - docs/operations/web-preview-runbook.md
  - scripts/web-preview-start.sh
  - scripts/web-preview-stop.sh
  - scripts/web-preview-status.sh
  - scripts/web-preview-rotate-secrets.sh
  - scripts/web-preview-smoke.sh
  - scripts/web-owner-cookie-proxy.py
-->

# Codex Console Web Managed Preview Runbook

This is the active owner-only preview path for `https://codex.guicheng.xyz`.

Architecture: localhost read-only Web app on `127.0.0.1:45682` -> localhost owner cookie proxy on `127.0.0.1:45683` -> Cloudflare named tunnel `codex-console`.

## Limits

- Personal project only: one owner, no multi-user auth system.
- Read-only Web state only: no Web action controls.
- No public unauthenticated bridge state: unauthenticated users see only the owner login page and `/healthz` proxy health.
- Scripts use local background processes and pid files. Systemd installation is intentionally deferred.

## Files and secrets

Default env file:

```sh
~/.config/codex-telegram-bridge/web-preview.env
```

The start script creates it with mode `600` and fills missing values:

- `CTB_WEB_READONLY_TOKEN`
- `CTB_WEB_PREVIEW_PASS` (or existing `CTB_WEB_BASIC_PASS` is accepted by the proxy)
- `CTB_WEB_SESSION_SECRET`
- `CTB_WEB_READONLY_PLATFORM=feishu`
- `CTB_WEB_READONLY_PORT=45682`
- `PROXY_PORT=45683`
- `UPSTREAM=http://127.0.0.1:45682`

Do not put these secrets in URLs, command lines, chat messages, docs, or logs.

State, pid files, and logs default to:

```sh
~/.local/state/codex-telegram-bridge/web-preview/
```

## Start

```sh
scripts/web-preview-start.sh
```

The script starts, in order:

1. read-only Web app
2. owner cookie proxy
3. Cloudflare named tunnel `codex-console`

It prints the public URL and the password file location, but not bearer/session secrets.

## Status

```sh
scripts/web-preview-status.sh
```

Check this before sharing or using the public URL. It reports managed pid files, ports, proxy `/healthz`, and the configured Cloudflare ready endpoint without printing secrets.

## Smoke

```sh
scripts/web-preview-smoke.sh
```

The smoke verifies:

- proxy `/healthz`
- unauthenticated login page
- owner login POST
- authenticated Home
- authenticated `/interactions`
- an optional conversation detail route when one is linked
- direct read-only app is not public without bearer auth
- obvious token/password/session-secret leaks in smoke responses

## Rotate secrets

```sh
scripts/web-preview-rotate-secrets.sh
scripts/web-preview-stop.sh
scripts/web-preview-start.sh
scripts/web-preview-smoke.sh
```

Rotation updates the bearer token, session secret, and owner preview password in the env file without printing them. Current processes keep old secrets until restart.

## Stop / rollback

```sh
scripts/web-preview-stop.sh
```

Stop order is public ingress first, then proxy, then read-only app. The script only uses the managed preview pid files and does not stop unrelated Cloudflare quick tunnels such as previews on `:8088`.

Rollback checklist:

1. Stop the preview.
2. Run status and confirm `45682`/`45683` are not listening for the managed stack.
3. If access was suspect, rotate secrets before the next start.
4. Confirm `https://codex.guicheng.xyz` shows a tunnel failure or login page only, never bridge state.
5. Keep the env file mode at `600`.
