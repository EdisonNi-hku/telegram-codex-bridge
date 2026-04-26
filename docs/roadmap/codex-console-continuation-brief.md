<!-- docmeta
role: leaf
layer: 3
parent: docs/roadmap/README.md
children: []
summary: active continuation brief for the next Codex Console tasks, optimized for low-context agent handoff
read_when:
  - starting any new Codex Console platform-abstraction task
  - deciding which current docs are relevant and which historical docs to skip
  - preparing future implementation or review prompts after the current continuation baseline
skip_when:
  - the task is only about shipped install/runtime behavior and a Tier-1 leaf is already known
source_of_truth:
  - docs/roadmap/codex-console-continuation-brief.md
  - docs/architecture/platform-capability-matrix.md
  - docs/architecture/platform-pack-boundary.md
  - docs/future/multi-platform-core-prd.md
  - docs/future/web-app-control-surface-sketch.md
-->

# Codex Console Continuation Brief

Status: active continuation entrypoint
Last updated: 2026-04-26

Use this as the first task handoff for future Codex Console / multi-platform bridge work. It replaces ad-hoc reading of older dated plans.

## One-Screen Current State

- Compatibility names stay unchanged: repo/package `telegram-codex-bridge`, CLI `ctb`, existing service/config/state paths.
- Product language is **Codex Console**.
- Internal shared direction is **Codex Bridge Core**.
- Telegram is the stable first/default pack.
- Feishu is a serious current pack with explicit setup/readiness caveats.
- Web/App is future design only; do not claim current support.
- Recent Phase 2 work is captured in `docs/plans/2026-04-26-codex-console-phase2-release-note.md`.

## Default Agent Reading Budget

For a new task, read at most:

1. this brief;
2. one current-truth leaf from `docs/product/`, `docs/architecture/`, or `docs/operations/`;
3. one implementation file or one protocol/future doc only if the task genuinely needs it.

Do not read the old dated plan archive by default. It is for archaeology, not active task context.

## Active Source Set

| Need | Open |
|---|---|
| current Telegram/Feishu capability and Web/App target rows | `docs/architecture/platform-capability-matrix.md` |
| current pack contract and Telegram/Feishu ownership split | `docs/architecture/platform-pack-boundary.md` |
| current install/admin and pack selection | `docs/operations/install-and-admin.md` |
| current product scope and compatibility boundary | `docs/product/v1-scope.md` |
| future Core product/architecture direction | `docs/future/multi-platform-core-prd.md` |
| future Web/App control surface sketch | `docs/future/web-app-control-surface-sketch.md` |
| official-API-backed Feishu audit and live-smoke caveat | `docs/plans/2026-04-26-feishu-official-capability-audit.md` |
| Phase 2 PR summary and verification | `docs/plans/2026-04-26-codex-console-phase2-release-note.md` |

## Archive Policy

Move a doc to `docs/archive/` when all are true:

- it describes a closed historical milestone, superseded PRD, or implementation plan;
- it is not the smallest source for any current or next task;
- reading it before current docs would likely bias an agent toward stale Telegram-only or pre-Core assumptions.

Archived docs remain searchable for reconstruction, but routers must not send agents there unless the task explicitly asks for history or current sources conflict.

## Current Archive Decisions

Archived from active routing in this cleanup:

- old V2/V3 future PRDs and engineering-evaluation material;
- old March implementation plans for V2/V3, runtime-card, project-picker, runtime-hub, systemd, performance, and final-answer recovery work.

Kept outside archive because they still help the current direction:

- March 23 and March 30 multi-platform Core / binding / surface notes;
- April 8 multi-platform Core + Feishu implementation plan;
- April 9 Feishu hardening plan;
- April 26 Feishu official capability audit;
- April 26 Phase 2 plan and release note.

## Next Sustainable Task Queue

1. **Live Feishu tenant smoke.** Verify text, cards, callbacks, file/image upload/download, long output, status/inspect, project/session selection, and degraded recovery.
2. **Feishu UX hardening.** Convert smoke results into specific pack/readiness fixes; keep non-native pin/menu/audio/image-url limits explicit.
3. **Docs context budget enforcement.** Keep routers pointing to this brief plus one leaf; archive or demote any new dated plan after closeout.
4. **Web/App pre-implementation gate.** Before coding Web/App, turn the sketch into stable Core/state/API contracts and readiness criteria.
5. **PR hygiene.** Each continuation PR should include a short release note, verification commands, and an archive/demotion decision for any temporary plan files.

## Noise Checks Before Adding A New Doc

Before creating a new doc, answer:

- Is this new doc the future entrypoint, or just a temporary plan?
- Which existing doc becomes less important because this exists?
- Should it be Tier 1 current truth, protocol evidence, future direction, active plan, or archive?
- What is the maximum number of docs an agent should read before acting?
- Will this doc cause an agent to overclaim current support?

If those answers are unclear, add the information to this brief or an existing leaf instead of creating a new top-level plan.
