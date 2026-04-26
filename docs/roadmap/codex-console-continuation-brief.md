<!-- docmeta
role: leaf
layer: 3
parent: docs/roadmap/README.md
children: []
summary: active continuation brief for the next Codex Console tasks, optimized for low-context agent handoff
read_when:
  - starting any new Codex Console platform-abstraction or Web Console task
  - deciding which current docs are relevant and which historical docs to skip
  - preparing future implementation or review prompts after the current continuation baseline
skip_when:
  - the task is only about shipped install/runtime behavior and a Tier-1 leaf is already known
source_of_truth:
  - docs/roadmap/codex-console-continuation-brief.md
  - docs/plans/2026-04-26-product-web-console-mvp.md
  - docs/plans/2026-04-26-web-first-pm-ledger.md
  - docs/plans/2026-04-26-web-protected-owner-access-plan.md
  - docs/plans/2026-04-26-web-gated-actions-design.md
  - docs/architecture/platform-capability-matrix.md
  - docs/architecture/platform-pack-boundary.md
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/operations/web-vps-mobile-access-and-security.md
-->

# Codex Console Continuation Brief

Status: active continuation entrypoint
Last updated: 2026-04-26

Use this as the first low-context task handoff for future Codex Console / multi-platform bridge work. It replaces ad-hoc reading of older dated plans.

## One-Screen Current State

**Owner direction, do not miss:** this is a personal owner project. The Web Console direction has pivoted to **Web Chat Platform**: Web should become a first-class chat surface for Codex Bridge, analogous to Telegram/Feishu. Do not steer future work back to dashboard/status/security/admin pages. Keep right-sized safety guardrails in the background: token gate, no secret/token leaks, no raw local paths or platform IDs by default, and no destructive/write actions beyond the explicitly chosen chat send lane.

- Compatibility names stay unchanged: repo/package `telegram-codex-bridge`, CLI `ctb`, existing service/config/state paths.
- Product language is **Codex Console**; the primary Web experience is a chat/work conversation surface.
- Internal shared direction is **Codex Bridge Core**.
- Telegram is the stable first/default pack.
- Feishu is a serious current pack with explicit setup/readiness caveats.
- Web has a temporary owner-only, read-only preview at `https://codex.guicheng.xyz` through Cloudflare Tunnel + local cookie proxy + localhost Web origin. This is **not** shipped/public/supported Web service.
- PR #16 branch has landed Phase 3 Product Web Console MVP read UX slices through commit `c8a13fc`:
  - real Product Web Console MVP IA/spec;
  - mobile-first `Codex Console` shell and readable conversation/task detail;
  - Web-safe final-answer body rendering only from injected sanitized sources;
  - conversation/task grouping with user-language state labels;
  - read-only Pending/Approvals cards with explicit action-disabled copy;
  - Runtime / Readiness / Settings read-only owner-language panels.
- Web actions remain unimplemented: no submit, approval-answer, question-answer, interrupt, upload/download, raw terminal, or project/session writes.
- App is alive but deferred until Web proves the shared contract path.
- Detailed run/verification/smoke state lives in `docs/plans/2026-04-26-web-first-pm-ledger.md`.

## Default Agent Reading Budget

For a new task, read at most:

1. this brief;
2. one active leaf from the table below;
3. one implementation file only if the task is coding.

Do not read archived dated plans by default. They are for archaeology, not active task context.

## Active Source Set

| Need | Open |
|---|---|
| current Web Console MVP scope, IA, read UX acceptance, final-answer source rules, ordered next slices | `docs/plans/2026-04-26-product-web-console-mvp.md` |
| detailed PM/controller ledger, exact commits, smoke proof, monitor cleanup, current branch state | `docs/plans/2026-04-26-web-first-pm-ledger.md` |
| protected owner-only access design gate, threat model, auth/session requirements, rollback, acceptance checklist | `docs/plans/2026-04-26-web-protected-owner-access-plan.md` |
| future Web submit, approval-answer, and interrupt action sequencing, safety preconditions, audit, tests, rollback gates | `docs/plans/2026-04-26-web-gated-actions-design.md` |
| approved Web-first MVP scope/readiness, validation path, and support-claim guardrails | `docs/future/web-mvp-scope-and-readiness.md` |
| future Web prototype VPS/mobile access, protected URL exposure, forbidden-data defaults, shutdown plan | `docs/operations/web-vps-mobile-access-and-security.md` |
| Web/App pre-implementation Core/state/API contract and readiness gates | `docs/architecture/web-app-preimplementation-contract.md` |
| current Telegram/Feishu capability and Web/App target rows | `docs/architecture/platform-capability-matrix.md` |
| current pack contract and Telegram/Feishu ownership split | `docs/architecture/platform-pack-boundary.md` |
| current install/admin and pack selection | `docs/operations/install-and-admin.md` |
| current product scope and compatibility boundary | `docs/product/v1-scope.md` |
| future Core product/architecture direction | `docs/future/multi-platform-core-prd.md` |
| future Web/App control surface sketch | `docs/future/web-app-control-surface-sketch.md` |
| official-API-backed Feishu audit and live-smoke caveat | `docs/plans/2026-04-26-feishu-official-capability-audit.md` |

## Archive Policy

Move a doc to `docs/archive/` when all are true:

- it describes a closed historical milestone, superseded PRD, or implementation plan;
- it is not the smallest source for any current or next task;
- reading it before current docs would likely bias an agent toward stale assumptions.

Archived docs remain searchable for reconstruction, but routers must not send agents there unless the task explicitly asks for history or current sources conflict.

## Current Archive Decisions

Archived from active routing in this closeout:

- Phase 2 plan and release note;
- Web-first project command board;
- Web MVP controller triage;
- Web view-model inventory;
- Web read-only prototype implementation plan;
- Web-first Phase 1 closeout.

Kept active because they still gate the next work:

- Product Web Console MVP spec;
- PM/controller ledger;
- protected owner access plan;
- gated actions design;
- current Feishu audit / hardening context.

## Current Runtime / Monitor State

At closeout:

- Hermes cron monitors for this PR/workstream: none enabled.
- Temporary owner preview may be running as manual processes:
  - `node --import tsx src/cli.ts web readonly --platform feishu --port 45682`;
  - `/tmp/ctb_web_cookie_proxy.py` on `127.0.0.1:45683`;
  - `cloudflared tunnel --config /home/ubuntu/.cloudflared/codex-console.yml run codex-console`.
- This preview is intentionally temporary. Use `/tmp/ctb-stop-codex-console-preview.sh` or kill the tracked processes when the owner is done reviewing.
- Local `.hermes/` status artifacts are scratch evidence and are intentionally uncommitted.

## Next Sustainable Task Queue

1. **PR #16 check/merge path.** Confirm latest Ubuntu checks pass; Windows failures are a documented non-Web baseline unless a new Web-specific failure appears. Update PR body if needed before merge.
2. **Owner proof package.** Capture sanitized mobile-width screenshot/HTML proof from the live owner preview now that the Runtime/Readiness slice has landed; verify no tokens, raw paths, raw IDs, conversation text overexposure, callback payloads, or platform internals.
3. **Independent overclaim/security review.** Read-only review of Web UI copy, docs routing, forbidden data, and action-disabled boundaries before declaring the MVP reviewable.
4. **Managed owner preview hardening.** Convert today’s temporary process chain into an explicit managed preview workflow only after owner approval: stable start/stop/rotate scripts, auth/session hardening, health checks, shutdown drill. Do not make it default service startup.
5. **First gated action lane decision.** Current pivot chooses text submit as the first Web Chat action lane after Phase B read UI. Start with a no-op/disabled composer in Phase B, then a text-only `POST /conversations/:handle/messages` in Phase C using the live bridge submit path.
6. **Live Feishu tenant smoke.** Separate current-pack readiness track: verify text, cards, callbacks, file/image upload/download, long output, status/inspect, project/session selection, and degraded recovery.
7. **Feishu UX hardening.** Convert smoke results into specific pack/readiness fixes; keep non-native pin/menu/audio/image-url limits explicit.
8. **Docs context budget enforcement.** Keep routers pointing to this brief plus one leaf; archive or demote temporary plan files after each closeout.

## Noise Checks Before Adding A New Doc

Before creating a new doc, answer:

- Is this new doc the future entrypoint, or just a temporary plan?
- Which existing doc becomes less important because this exists?
- Should it be Tier 1 current truth, protocol evidence, future direction, active plan, or archive?
- What is the maximum number of docs an agent should read before acting?
- Will this doc cause an agent to overclaim current support?

If those answers are unclear, add the information to this brief or an existing leaf instead of creating a new top-level plan.
