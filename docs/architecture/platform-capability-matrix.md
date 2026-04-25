<!-- docmeta
role: leaf
layer: 3
parent: docs/architecture/README.md
children: []
summary: current Codex Console capability matrix for Telegram and Feishu, plus future Web/App target rows
read_when:
  - the request is about what Telegram or Feishu currently supports
  - the request is about which capabilities belong in Core, Presentation, Pack, or Skill
  - the request is about future Web/App platform planning without making the matrix Telegram-shaped
skip_when:
  - the request is only about exact Telegram callback payload encoding
  - the request is only about install command syntax or operator paths
source_of_truth:
  - docs/architecture/platform-capability-matrix.md
  - docs/architecture/platform-pack-boundary.md
  - docs/architecture/platform-decoupling-status.md
  - docs/future/multi-platform-core-prd.md
  - src/core/interaction-model/surface.ts
  - src/packs/contract.ts
  - src/packs/telegram/index.ts
  - src/packs/feishu/index.ts
  - src/telegram/surface-adapter.ts
  - pack-manifest.json
-->

# Platform Capability Matrix

Verified against the current docs and implementation on 2026-04-25.

Use this file to answer:

- what Telegram and Feishu currently support in Codex Console
- which capabilities are shared product expectations versus platform-specific features
- how future Web/App surfaces should be evaluated without copying Telegram or Feishu

## Naming And Current Truth

- External product name: **Codex Console**.
- Internal shared architecture name: **Codex Bridge Core**.
- Repository/package compatibility name: `telegram-codex-bridge`.
- Current supported packs: **Telegram** and **Feishu**.
- Default pack: **Telegram**.
- Feishu is a serious current pack, not merely a theoretical experiment.
- Codex Console is not yet a fully platform-neutral product core; the shared service shell still has Telegram-shaped history.

## Symbols

| Symbol | Label | Meaning |
|---|---|---|
| ✅ | Native | First-class current support on this platform. |
| ◐ | Adapted | Supported through an acceptable platform-specific adaptation or reduced UX. |
| △ | Fallback | Product meaning can work, but through text/manual refresh/files/split messages/etc. |
| — | Not supported | This platform does not provide this capability today. |
| ⚠ | Blocker / unverified | Required or claimed area that depends on missing setup, missing runtime path, or unverified behavior. |

Rules:

- Do not read ✅ as "Telegram-like". A future Web/App ✅ may mean a dashboard, panel, modal, or form.
- Do not collapse setup readiness and static platform capability into one idea. Feishu upload/callback support depends on permissions and observed setup checks.
- If a universal expectation is not at least △, the platform should not be called a supported Codex Console pack.

## Layer Ownership

| Layer | Owns | Must not own |
|---|---|---|
| **Core** | project/session meaning, turn lifecycle, interactions, runtime state, final-answer meaning, delivery outcomes | Telegram buttons, Feishu card JSON, Web layout, platform credentials |
| **Capability** | whether a platform can support buttons/actions, edits/live updates, rich previews, pagination, media, files, degraded delivery | product workflow decisions |
| **Presentation** | how a state/interaction/result is rendered for one surface | pack credential flow or runtime state machine |
| **Pack** | platform identity, ingress, egress, auth binding, install validation, health checks, platform dynamic tools | shared Codex workflow semantics |
| **Skill / Setup** | guided external setup, credential collection, operator checklist, smoke test | long-lived runtime architecture |

## Universal Product Expectations

These are Codex Console baseline expectations. A supported platform can satisfy them natively or through fallback, but it should not be considered ready if it cannot satisfy the product meaning at all.

| Capability area | Core expectation | Telegram | Feishu | Future Web/App target | Owner layer | Notes |
|---|---|---:|---:|---:|---|---|
| Operator identity & auth | Bind the allowed operator/control surface and report ready/awaiting/unhealthy | ✅ | ✅ | ✅ | Pack + Skill | Platform credentials stay pack-specific. |
| Project/session lifecycle | Make active project/session explicit; support start/resume/switch | ✅ | ◐ | ✅ | Core + Presentation | Feishu currently rides the shared Telegram-shaped service path. |
| Turn input & continuation | Send new text tasks and continue blocked turns | ✅ | ✅ | ✅ | Core + Pack | Text is the baseline input capability. |
| Approvals & questions | Present request, collect answer, show resolved/expired/failed state | ✅ | ✅ | ✅ | Core + Presentation | Telegram uses callbacks; Feishu uses card callbacks/adapters; Web/App should use forms/modals. |
| Runtime visibility | Show running/blocked/done/failed state, progress, inspect/status detail | ✅ | ◐ | ✅ | Core + Presentation | Feishu has adapted cards; Web/App should eventually be richer than chat. |
| Interrupt / stop | Stop active turn safely from the control surface | ✅ | ✅ | ✅ | Core + Pack | The exact UI should vary by platform. |
| Final answer delivery | Deliver final answer separately from transient progress and avoid silent truncation | ✅ | ◐ | ✅ | Core + Presentation | Long-form UX is platform-tiered below. |
| Recovery / degraded delivery | Represent sent, edited/updated, deferred, failed/rate-limited outcomes | ✅ | ◐ | ✅ | Core + Presentation | Existing Core surface outcomes support this direction. |
| Install/config/health | Validate pack credentials, setup state, and readiness | ✅ | ◐ | ✅ | Pack + Skill | Feishu has more external setup and observed-readiness checks. |

## UX Richness Matrix

These rows decide how good the experience can be on a platform. They should not redefine the shared Core workflow.

| Capability | Telegram | Feishu | Future Web/App target | Notes |
|---|---:|---:|---:|---|
| Native interactive controls | ✅ | ✅ | ✅ | Telegram inline buttons; Feishu interactive cards; Web/App forms/buttons. |
| Editable / live surfaces | ✅ | ✅ | ✅ | Telegram message edits; Feishu card/message updates; Web/App live panels. |
| Rich text / preview rendering | ✅ | ✅ | ✅ | Both current packs declare rich preview support. |
| Long-form pagination / collapse | ✅ | ✅ | ✅ | Current packs declare long-form pagination; Web/App should use richer navigation. |
| Runtime hub / status surfaces | ✅ | ◐ | ✅ | Telegram is reference UX; Feishu is adapted through cards/compat layer. |
| Inspect / recent output detail | ✅ | ◐ | ✅ | Web/App should eventually be the best surface for dense detail. |
| Project picker | ✅ | ◐ | ✅ | Feishu support depends on adapted buttons/cards. |
| Read-only project browsing | ✅ | ◐ | ✅ | Web/App should eventually provide stronger browse/history UX. |
| Native command/menu discovery | ✅ | ◐ | ✅ | Telegram syncs command menu; Feishu bot menu exposes a smaller native entry set. |
| Background/progress notifications | ✅ | ◐ | ✅ | Feishu depends on long-connection/event setup. |
| Long final answers | ✅ | ◐ | ✅ | Chat platforms need collapse/pagination/file fallback; Web/App can use history/pages. |

## Ingress Matrix

| Input / event | Telegram | Feishu | Future Web/App target | Notes |
|---|---:|---:|---:|---|
| Text messages / task input | ✅ | ✅ | ✅ | Baseline for supported packs. |
| Slash/text commands | ✅ | ◐ | ✅ | Feishu can route text commands, but native bot menu is limited. |
| Native command menu | ✅ | ◐ | ✅ | Feishu currently exposes `new`, `status`, `sessions`, `help` in bot-menu style surfaces. |
| Callback/action events | ✅ | ✅ | ✅ | Feishu requires interactive card callback setup and observation. |
| Rich structured input ownership | ✅ | ◐ | ✅ | Telegram owns rich input; Feishu supports adapted message resources but pack metadata does not own rich input. |
| Receive images | ✅ | ✅ | ✅ | Feishu receives images via message-resource descriptors/download. |
| Receive files | ✅ | ✅ | ✅ | Feishu receives files via message-resource descriptors/download. |
| Receive voice/audio | ✅ | — | ✅/△ | Telegram voice requires transcription readiness; Feishu pack declares voice false. |
| Remote image URL input | — | — | ✅/△ | Current packs declare remote image URL support false. |
| Group/team multi-user input | — | — | △ | Current product is high-trust/single-operator; Web/App would need a separate product decision. |

## Egress And Media Matrix

| Output / delivery | Telegram | Feishu | Future Web/App target | Notes |
|---|---:|---:|---:|---|
| Plain text messages | ✅ | ✅ | ✅ | Baseline. |
| Rich cards / rich messages | ✅ | ✅ | ✅ | Telegram HTML/inline UI; Feishu interactive cards; Web/App panels. |
| Edit/update existing surface | ✅ | ✅ | ✅ | Feishu updates cards/messages through adapter behavior. |
| Delete/retire old surface | ✅ | ◐ | ✅ | Feishu adapter has send/delete/edit fallbacks; exact semantics differ. |
| Pin/unpin | ✅ | △ | △ | Feishu compatibility currently returns success without real platform pinning; do not treat as native. |
| Send image to control surface | ✅ | ✅ | ✅ | Pack-specific dynamic tools exist for Telegram and Feishu. |
| Send file to control surface | ✅ | ✅ | ✅ | Feishu upload support depends on app scopes and probes. |
| Use remote image URL for output | — | — | ✅/△ | Current packs declare false. |
| File/image upload readiness checks | ◐ | ✅ | ✅ | Feishu explicitly probes file/image upload scopes; Telegram validates bot credentials. |

## Current Pack Summary

| Area | Telegram | Feishu |
|---|---|---|
| Pack status | Stable first/default pack | Serious current pack |
| Skill bundle | `telegram-codex-linker` | `feishu-codex-linker` |
| Primary credentials | `TELEGRAM_BOT_TOKEN` | `FEISHU_APP_ID`, `FEISHU_APP_SECRET` |
| API family | Telegram Bot API | Feishu OpenAPI / long-connection via compatibility adapters |
| Ingress | Polling | Feishu event/long-connection compatibility poller, despite pack metadata currently saying polling |
| Presentation preference | Telegram-native command/buttons | Bridge command buttons and Feishu cards |
| Dynamic tools | `send_telegram_document`, `send_telegram_image` | `send_feishu_file`, `send_feishu_image` |
| Voice input | Supported when transcription is configured | Not supported today |
| Setup complexity | Lower: bot token + authorization | Higher: app credentials, bot ability, scopes, events, card callbacks, publishing/long-connection |
| Main caveat | Product docs still mostly use Telegram as reference UX | Runtime works through Telegram-compatible service adapters, so the boundary is not yet clean |

## Capability Readiness Levels

For future pack planning, track four readiness levels separately:

1. **Static declared capability** — the pack says the platform can do it.
2. **Configured capability** — credentials, scopes, app settings, and local dependencies are present.
3. **Observed capability** — the bridge has seen text ingress, callback/action events, uploads, or other required platform signals.
4. **UX-exposed capability** — users can reach it through menus, cards, commands, buttons, or docs.

This matters because a row can be technically true but not ready for users. Examples:

- Feishu declares callbacks and uploads, but callbacks require card-action setup and uploads require app scopes.
- Telegram declares voice receive, but useful voice input also depends on transcription configuration.
- A future Web/App surface may have excellent UI affordances but should not count as supported until it reuses Core workflow semantics.

## What Stays Platform-Specific

Do not move these into Codex Bridge Core:

- Telegram callback payload encoding, inline keyboard layout, Bot API quirks, message ids, command registration, BotFather token flow.
- Feishu card schema, tenant token flow, app credentials, scope probing, event subscription, OpenAPI upload/download details.
- Web/App routes, component library, CSS/layout, browser storage, websocket/SSE plumbing, desktop/mobile notification APIs.
- Platform-specific media resource ids, upload handles, download URLs, conversation ids, and message ids.
- Platform-specific dynamic tool names; Core should know shared actions like "send image/file to the active control surface".

## Web/App Planning Implications

A future Web/App surface should not be a fake chat pack.

It should reuse Codex Bridge Core semantics:

- project/session state
- turn lifecycle
- approvals/questions
- runtime status and progress
- final answers and artifacts
- delivery outcomes and degraded states

But it should use native Web/App presentation:

- dashboards, sidebars, tabs, panels
- forms/modals for approvals
- durable final-answer history
- richer project browsing and file previews
- live updates through Web/App transport
- explicit admin/setup pages

Separate product decisions are still required before Web/App expands scope into multi-user collaboration, provider setup, raw terminal views, project write operations, or team permissions.

## Owner Decision Rules

Use these rules before adding a new platform:

1. **No platform support claim without a complete baseline journey.** The user must be able to authorize, choose a project/session, send a task, answer an interaction, inspect progress, interrupt if needed, and receive the final answer.
2. **No forced UX parity.** A platform can be supported even if it does not look like Telegram or Feishu.
3. **No hidden Core fork.** A richer Web/App surface must reuse Core workflow semantics rather than becoming a parallel product.
4. **No boolean-only capability claims.** Track static/configured/observed/UX-exposed readiness separately.
5. **No third platform before the second-platform lessons are captured.** Feishu should continue to expose which assumptions are still Telegram-shaped.

## Current Caveats

- Feishu pack metadata currently contains compatibility-shaped labels (`polling`, `bot_api`) while actual behavior uses Feishu long-connection/OpenAPI adapters.
- Feishu `ownsRichInput` and `ownsMediaIngress` are false even though Feishu can adapt image/file message resources through shared compatibility paths.
- Feishu pin/unpin is not a native capability today.
- Current product docs still describe many current flows through Telegram UX because Telegram remains the reference/default path.
- Broad Slack/Discord/Web/App support remains future scope.
