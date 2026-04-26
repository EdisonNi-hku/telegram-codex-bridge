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
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/operations/web-vps-mobile-access-and-security.md
  - docs/architecture/web-app-preimplementation-contract.md
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
- Web has an approved read-mostly future MVP scope/readiness lane; do not claim current support.
- App is alive but deferred until Web proves the shared contract path.
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
| approved Web-first MVP scope/readiness, action gates, VPS/mobile validation, and support-claim guardrails | `docs/future/web-mvp-scope-and-readiness.md` |
| future Web prototype VPS/mobile access, protected URL exposure, forbidden-data defaults, and shutdown plan | `docs/operations/web-vps-mobile-access-and-security.md` |
| Web/App pre-implementation contract and readiness gates | `docs/architecture/web-app-preimplementation-contract.md` |
| future read-only Web prototype implementation planning | `docs/plans/2026-04-26-web-readonly-prototype-implementation-plan.md` |
| future read-only Web view-model inventory and first adapter seam | `docs/plans/2026-04-26-web-viewmodel-inventory.md` |
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

1. **W4 formal Web MVP docs landing — complete/landed.** Use the Web MVP scope/readiness leaf as the owner-readable source for the approved Web-first, App-later, read-mostly first lane.
2. **W5 VPS/mobile access and security plan — complete/landed.** Use the operations access/security plan as the owner-readable source for screenshot-first validation, protected URL exposure choices, forbidden-data defaults, phone checklist, and shutdown gates.
3. **Independent scope/readiness/security review — complete/landed.** The action-control wording blocker was fixed; first lane is strictly read-mostly with actions deferred to later lanes.
4. **Web prototype implementation planning — complete/landed.** Use the read-only prototype implementation plan for page skeletons, candidate Core/state surfaces, redacted data contracts, auth assumptions, validation flow, forbidden scope, and future coding milestones.
5. **W9 read-only Web view-model inventory — complete/landed.** Use the inventory for the service-level adapter seam and remaining read-only gaps, not routes, auth middleware, task submission, or action controls.
6. **Web service view-model seam closeout/hygiene — current.** The first read-only adapter, Gap1 final-answer/workspace redaction, and Gap2 pending-interactions read model have landed; closeout should keep docs/status wording aligned without claiming Web support.
7. **Gap3 neutral artifact catalog/descriptors — next implementation after closeout.** Keep this read-only and descriptor-only; do not add routes, UI, auth, servers, writes, downloads, uploads, or action controls.
8. **Live Feishu tenant smoke.** Verify text, cards, callbacks, file/image upload/download, long output, status/inspect, project/session selection, and degraded recovery as a separate current-pack readiness track.
9. **Feishu UX hardening.** Convert smoke results into specific pack/readiness fixes; keep non-native pin/menu/audio/image-url limits explicit.
10. **Docs context budget enforcement and PR hygiene.** Keep routers pointing to this brief plus one leaf; archive or demote temporary plan files after closeout, and include verification commands in each continuation PR.

## Noise Checks Before Adding A New Doc

Before creating a new doc, answer:

- Is this new doc the future entrypoint, or just a temporary plan?
- Which existing doc becomes less important because this exists?
- Should it be Tier 1 current truth, protocol evidence, future direction, active plan, or archive?
- What is the maximum number of docs an agent should read before acting?
- Will this doc cause an agent to overclaim current support?

If those answers are unclear, add the information to this brief or an existing leaf instead of creating a new top-level plan.
