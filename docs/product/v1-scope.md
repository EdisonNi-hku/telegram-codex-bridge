<!-- docmeta
role: leaf
layer: 3
parent: docs/product/README.md
children: []
summary: current shipped v1 scope, trust model, and out-of-scope boundary for Codex Console's Telegram-first baseline
read_when:
  - the task is about what v1 includes, excludes, or deliberately does not promise
  - the task needs the current trust model before implementation or docs changes
skip_when:
  - the task is mainly about current runtime internals or source ownership
source_of_truth:
  - docs/product/v1-scope.md
  - docs/future/multi-platform-core-prd.md
-->

# Codex Console v1 Scope

Current truth note:
- external product name is **Codex Console**
- internal architecture name is **Codex Bridge Core**
- this file describes the **current Telegram-first baseline and trust model**
- Telegram remains the stable first pack and default install path
- Feishu is a serious current pack, but broad multi-platform production maturity is not claimed here
- the in-scope list below is the stable Telegram baseline; Feishu current-pack capability and readiness are covered by the pack boundary, operations docs, and platform capability matrix
- future product direction belongs in `docs/future/multi-platform-core-prd.md`

## Goal

Build a VPS-hosted Codex Console that wakes and controls the Codex installation that already exists on the server.

Telegram is the stable first control surface.
Codex remains the execution engine.
The bridge is not a second Codex environment, not a provider-management layer, and not a second permission system.

## In Scope

- stable Telegram baseline: single authorized Telegram user
- stable Telegram baseline: Telegram private chat only
- one bridge service per server
- Feishu can be selected as the active current pack, with its capability and setup completeness judged by the pack-aware docs rather than by this Telegram baseline list
- reuse the server's existing Codex environment
- project-aware session startup
- read-only project file browsing for the active session, including directory navigation plus text and image preview inside the current project root
- compact structured runtime visibility in Telegram
- separate final-answer delivery
- on-demand `/inspect` task snapshots and `/where` session locators
- multiple sessions with switching
- one active session per chat
- Telegram-driven interrupt of the active turn
- bridge-owned Telegram interaction cards for approvals and structured user input when Codex emits server requests
- model discovery and per-session model selection
- review start, skills discovery and selection, and thread fork / rollback / compact / rename / metadata controls where the current CLI exposes stable support
- plugin discovery plus install/uninstall where the current CLI exposes stable support
- app discovery where the current CLI exposes stable support
- MCP status, reload, and OAuth-login-link surfaces where the current CLI exposes stable support
- account diagnostics and thread background-terminal cleanup where the current CLI exposes stable support
- rich input submission for `text`, `localImage`, `skill`, and `mention`
- Telegram photo upload adaptation into bridge-managed `localImage` input
- optional Telegram voice-message adaptation into transcribed text input when voice input is enabled
- one-line install plus local self-check
- operator-managed full-access runtime with adapted Telegram UX instead of a raw terminal
- current repository direction is Codex Console powered by Codex Bridge Core, but this v1 baseline does not claim every surface is fully platform-neutral

## Out Of Scope

- group chats
- multi-user access
- Telegram-side execution policy beyond access identity
- raw or token-level streaming of tool calls, patches, or reasoning
- reasoning surfaces in the normal Telegram chat flow
- Telegram-driven provider setup
- general collaboration-mode discovery or preset selection beyond the existing `/plan` toggle
- direct Telegram command support for schema-level remote URL `image` input
- raw-terminal emulation or fake terminal widgets
- project-file write, rename, or delete operations from Telegram
- client-managed dynamic tool execution via `item/tool/call`, because the live schema exposes only generic tool name plus arguments and does not give the bridge a stable Telegram-safe tool registry
- client-managed ChatGPT token refresh via `account/chatgptAuthTokens/refresh`, because the bridge does not own ChatGPT access tokens or workspace ids and Telegram is not the provider-setup UX
- `command/exec*`, `feedback/upload`, `fuzzyFileSearch*`, and `externalAgentConfig/*`
- a first-class Telegram transport inside Codex core
- broad additional platform packs such as Slack or Discord
- a first-class Web or App control console

## Runtime Assumption

v1 assumes the server operator intentionally runs Codex in a high-trust, full-access Codex environment.

That means:
- Telegram is still the control plane into a high-trust runtime.
- The bridge may relay explicit Codex server requests back to Telegram, but that relay is bridge UX, not a second sandbox or policy engine.
- Execution risk is intentionally accepted by the server operator as part of the deployment model.

This is a deliberate product boundary, not a missing feature.

## Risk Boundary

v1 should be deployed only by operators who explicitly accept that:
- Telegram is a direct control plane into a high-trust Codex runtime.
- access control at the Telegram identity boundary matters more, not less
- the bridge may rank or group project choices, but it must never silently choose one

## User-Facing Copy Rules

Prefer:
- `选择要新建会话的项目`
- `已收藏`
- `最近使用`
- `本地发现`
- `扫描本地项目`
- `手动输入路径`
- `当前项目：{project_name}`

Avoid in the main user flow:
- `workdir`
- `cwd`
- `API key`
- `provider`
- `transport`
- `sandbox mode`

Those terms may appear in local administrator diagnostics only.

## Final v1 Rule

The bridge may rank visible project choices, but it must never silently choose the project.

Before the first real task is sent, the user must always be able to see which project the next Codex session will operate on.
