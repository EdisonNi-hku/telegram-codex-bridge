<!-- docmeta
role: leaf
layer: 3
parent: docs/product/README.md
children: []
summary: current callback namespace families, encoding rules, and stale-click contract for bridge-owned Telegram UI
read_when:
  - the task is about Telegram callback payload families, encoding limits, or stale/duplicate callback behavior
skip_when:
  - the task is only about text-command behavior with no callback surface
source_of_truth:
  - docs/product/callback-contract.md
  - src/telegram/ui-callbacks.ts
  - src/service/callback-router.ts
-->

# Callback Contract

Current intended behavior for bridge-owned Telegram callback payloads.

This file covers:
- callback namespace families emitted by the bridge
- compact encoding rules and stale/duplicate-click semantics
- which interactions stay as text commands versus callback actions

When implementation detail matters, verify against:
- `src/telegram/ui-callbacks.ts`
- `src/service/callback-router.ts`
- the narrow owner under `src/service/` for the relevant surface

## Versioned Callback Families

Versioned callback families currently emitted by the bridge:
- `v1` project picker and session-surface callbacks: `pick:{project_key}`, `scan:more` (legacy compatibility), `new:browse`, `new:browse:root:{index36}`, `new:browse:back`, `path:manual`, `path:back`, `path:confirm:{project_key}`, `rename:session:{session_id}`, `rename:project:{session_id}`, `rename:project:clear:{session_id}`, `plan:expand|collapse:{session_id}`, `agent:expand|collapse:{session_id}`, `final:open|close|page:{answer_id}[:{page}]`
- `v2` model picker callbacks: `model:default|close:{session_id}`, `model:page:{session_id}:{page36}`, `model:pick:{session_id}:{model_index36}`, `model:effort:{session_id}:{model_index36}:{effort|default}`
- `v3` interaction callbacks: compact `ix:d|q|t|c|a:...` forms using base64url interaction tokens plus base36 indexes; legacy `v3:ix:decision|question|text|cancel:...` callbacks are still accepted for compatibility
- `v4` runtime and long-tail UI callbacks: `plan:open|close|page:{answer_id}[:{page}]`, `rt:p|t|s|r|c:{token}[:{value}]`, `lg:s:{zh|en}` and `lg:c`, `in:e|c|p|x:{session_id}[:{page36}]`, `rb:p|k|c|b|x:{session_id}:...`, `pr:i:{answer_id}`
- `v5` targeted runtime status and project-browser callbacks: `st:i|x:{session_id}`, `br:o|p|u|r|f|b|c|n|y|k:{token}[:{value36}]`
- `v6` runtime-hub slot selector callbacks: `hb:s:{token}:{version36}:{slot36}`
- `v7` recent-output entry callbacks: `rr:o|c|p:{answer_id}[:{page36}]`
- `v8` command-panel callbacks: `cp:o`, `cp:h`, `cp:r:{command}`, `ce:o`, `ce:p:{token}:{page36}`, `ce:t:{token}:{command}`, `ce:s|r|c:{token}`
- `v9` native user-shell confirmation callbacks: `sh:y|n:{token}`
- `v10` Telegram file-retrieval confirmation callbacks: `rt:y|n:{token}`
- `v11` Telegram Side callbacks: `v11:sd:s|b|i|y|n:{token}` for parent status, return, Side interrupt, confirmed return, and canceled return

Rules:
- `project_key` is a stable short hash of the project path, never the raw path
- `interaction_token` is a bridge-owned compact token for the persisted interaction id, not a raw protocol id
- decision and question selectors are compact bridge-local indexes, not raw `decision_key` or `question_id` values
- runtime field selectors use short bridge-owned codes such as `mn`, `mw`, `pm`, and `fr`
- compact callback indexes use base36 encoding to stay within Telegram size limits
- `v9` shell and `v10` retrieval confirmations use opaque bridge-owned tokens; both are single-use and expire after two minutes; replacement or a later click after consumption returns stale feedback, a click after expiry but before timer cleanup returns expired feedback, and timer-pruned post-expiry clicks may return stale/invalid feedback because the pending token no longer exists; a binding mismatch returns a surface-specific refusal while consuming the token
- retrieval confirmation tokens are bound to the authorized chat, active session, project, and resolved target path; `y` confirms sending and `n` cancels without sending
- Side card and return-confirmation tokens are memory-only and bound to the authorized chat plus the active Side relationship; running-turn return confirmations are single-use, expire after two minutes, and stale or replaced Side actions return `这个 Side 操作已失效。`
- bridge-emitted callback payloads must stay within Telegram's 64-byte `callback_data` limit; interaction callbacks are the tightest budget
- duplicate clicks on persisted interaction callbacks must be idempotent and return `这个操作已处理。`; single-use `v9` and `v10` confirmations instead return their compact stale/expired feedback
- stale callbacks must return a compact expiry notice; generic interaction flows use `这个按钮已过期，请重新操作。`, while surface-specific flows may ask the user to re-send `/browse`, `/runtime`, `/inspect`, or `/rollback`
- pre-session browse callbacks (`v1:new:browse:*` and `v5:br:n|y|k:*`) are bridge-owned flows and must stay idempotent like other picker callbacks
- list-based bridge session switching and pinning remain text commands (`/use <n>` and `/pin`); Codex history resume selection uses bridge-owned numeric picker callbacks
- interaction callbacks are bridge-owned UX for persisted pending interactions, not raw protocol passthrough
- resume, rename, model, runtime, language, inspect, rollback, plan-result, recent-output, and hub-selector callbacks are bridge-owned UI contracts, not raw Codex callback passthrough
