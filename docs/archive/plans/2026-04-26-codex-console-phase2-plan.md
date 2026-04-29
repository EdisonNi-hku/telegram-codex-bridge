<!-- archived: moved from active plans after Phase 3 closeout; historical reconstruction only. Start new work from docs/roadmap/codex-console-continuation-brief.md. -->
# Codex Console Phase 2 Implementation Plan

> **For Hermes:** Coordinate with real Codex high runs phase-by-phase, then perform controller-side verification before each commit.

**Goal:** Finish Codex Console next-step landing: clearer install/docs, Feishu official-doc-based capability audit, Core/Pack naming cleanup, Web/App integration sketch, and PR/release note.

**Architecture:** Keep repository/package/CLI compatibility names unchanged. Treat Telegram as stable first/default pack and Feishu as serious current pack. Use official Feishu developer documentation plus implementation evidence before changing capability claims. Keep Web/App as a design plan, not implementation.

**Tech Stack:** TypeScript, Node, markdown docs, Codex CLI, Feishu Developer Docs MCP.

---

### Task 1: README and install-entry de-Telegram-only docs

**Objective:** Make the landing/install path explain Telegram default, Feishu setup entry, and capability boundaries without renaming package/CLI/service identifiers.

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/install-and-admin.md`
- Modify: `docs/product/v1-scope.md` if scope wording needs tightening
- Optional Modify: `scripts/README` or installer docs only if such file exists and is routed

**Steps:**
1. Inspect README/install docs for Telegram-only public wording.
2. Add explicit Telegram default path and Feishu pack-aware install examples.
3. Preserve compatibility names: package `telegram-codex-bridge`, CLI `ctb`, existing service paths.
4. Run `git diff --check` and `npm run check`.
5. Commit as `docs: clarify Codex Console install paths`.

### Task 2: Feishu official-doc-backed capability/smoke audit

**Objective:** Compare current Feishu implementation and smoke-test requirements against official Feishu docs for messages, interactive cards, callbacks, files/images, events, and long connection.

**Files:**
- Create: `docs/plans/2026-04-26-feishu-official-capability-audit.md`
- Modify: `docs/architecture/platform-capability-matrix.md` if claims need correction
- Modify: `docs/architecture/platform-pack-boundary.md` if pack boundary caveats need correction

**Official-doc evidence required:**
- Feishu event subscription / long connection behavior
- Message receive events and message resource download
- Send/update interactive cards or card messages
- Card action callbacks / triggers
- Image/file upload and send-message APIs
- Any documented constraints relevant to long output, markdown, or card content

**Steps:**
1. Use Feishu Developer Docs MCP and/or repo local docs cache if available.
2. For each matrix row: text, cards, callback, file, image, long output, status/runtime cards, session switching, verify code path + official API feasibility.
3. Produce smoke checklist: command/input, expected platform event/API, current code path, observed/log evidence needed, verdict.
4. Patch docs only if current matrix overclaims or underclaims.
5. Run doc/link checks, `git diff --check`, `npm run check`.
6. Commit as `docs: audit Feishu capability against official APIs`.

### Task 3: Core/Pack compatibility-shaped metadata cleanup

**Objective:** Fix obvious naming/metadata mismatches such as Feishu pack saying `polling` / `bot_api` when the actual path is Feishu long-connection/OpenAPI compatibility adapters.

**Files:**
- Modify: `src/packs/contract.ts`
- Modify: `src/packs/feishu/index.ts`
- Modify: `src/packs/telegram/index.ts` only if the contract enum/type requires it
- Modify tests adjacent to pack contract/registry/readiness if present
- Modify docs that describe metadata if names change

**Steps:**
1. Inspect current contract literals and test expectations.
2. Decide minimal backward-compatible vocabulary change.
3. Add/update tests first for Feishu metadata values.
4. Implement minimal code change.
5. Run targeted tests plus `npm run check` and `npm test` if practical.
6. Commit as `refactor: clarify Feishu pack transport metadata`.

### Task 4: Web/App integration sketch

**Objective:** Define how future Web/App pack connects to Codex Bridge Core without starting implementation.

**Files:**
- Create: `docs/future/web-app-control-surface-sketch.md`
- Modify: `docs/future/README.md`
- Modify: `docs/future/multi-platform-core-prd.md` if it should point to the sketch

**Steps:**
1. Reuse platform capability matrix and Core/Pack boundaries.
2. Define required Core state/API surfaces: session, project, turn, runtime, interaction, artifacts/final answer, delivery outcomes.
3. Define Web/App pack responsibilities: auth/session UI, routes, panels, forms, live transport, notifications, file picker/upload.
4. List non-goals: multi-user, provider setup, raw terminal, project writes unless separately approved.
5. Run docs checks.
6. Commit as `docs: sketch Web App control surface`.

### Task 5: PR/release note

**Objective:** Package the changes as a readable owner-facing change set.

**Files:**
- Create: `docs/plans/2026-04-26-codex-console-phase2-release-note.md` or a PR body draft under `.hermes/`

**Steps:**
1. Summarize commits and user-visible changes.
2. State compatibility: no package/CLI/service rename.
3. State verification commands and results.
4. Create PR if remote workflow is clean and user wants it; otherwise leave branch ready with PR body.
