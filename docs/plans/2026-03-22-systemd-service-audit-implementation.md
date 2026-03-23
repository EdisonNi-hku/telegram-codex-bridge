# Systemd Service Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture actionable Linux/systemd stop diagnostics so the next bridge outage clearly shows whether the service was stopped intentionally, failed, received a signal, or was terminated by resource pressure.

**Architecture:** Add a Linux-only service audit snapshot that is written by a new CLI audit command invoked from the systemd unit's `ExecStopPost`. Feed the latest audit snapshot into `ctb status` and `ctb doctor`, and add bridge-side shutdown logging so the process records which signal or fatal path it observed before systemd finishes stopping the unit.

**Tech Stack:** TypeScript, Node.js, systemd user services, journalctl/systemctl integration, existing `ctb` CLI/install flow.

---

### Task 1: Add the failing tests for service audit capture

**Files:**
- Modify: `src/install.test.ts`
- Test: `src/install.test.ts`

**Step 1: Write the failing test**

Add coverage for:
- parsing a synthetic systemd audit snapshot into `ctb status`
- `ctb doctor` including the latest audit metadata
- the generated systemd unit containing an `ExecStopPost` hook for audit capture

**Step 2: Run test to verify it fails**

Run: `npm test -- src/install.test.ts`
Expected: FAIL because the audit snapshot plumbing and `ExecStopPost` hook do not exist yet.

**Step 3: Write minimal implementation**

Implement only enough structure to make the new assertions reachable:
- a new audit snapshot path
- status/doctor output lines
- unit-file hook text

**Step 4: Run test to verify it passes**

Run: `npm test -- src/install.test.ts`
Expected: PASS

### Task 2: Add the failing tests for bridge-side shutdown logging

**Files:**
- Modify: `src/service.test.ts`
- Test: `src/service.test.ts`

**Step 1: Write the failing test**

Add a focused test that simulates bridge shutdown entry and expects the logger to persist a structured shutdown request record with signal/source details.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/service.test.ts`
Expected: FAIL because shutdown signal audit logging is not emitted yet.

**Step 3: Write minimal implementation**

Teach the service bootstrap/shutdown path to log:
- signal name
- whether shutdown was already in progress
- active-turn/session counts where practical

**Step 4: Run test to verify it passes**

Run: `npm test -- src/service.test.ts`
Expected: PASS

### Task 3: Implement systemd audit snapshot capture

**Files:**
- Modify: `src/install.ts`
- Modify: `src/paths.ts`
- Modify: `src/cli.ts`

**Step 1: Write the failing test**

Extend the install/status tests first so they describe the target snapshot format and CLI audit command behavior.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/install.test.ts`
Expected: FAIL with missing fields/commands.

**Step 3: Write minimal implementation**

Implement:
- a dedicated audit snapshot file path under state
- a CLI subcommand for systemd stop-post capture
- systemctl/journalctl data collection for service result, exit status, recent stop lines, and possible OOM/signal clues
- human-readable status/doctor fields from the latest snapshot

**Step 4: Run test to verify it passes**

Run: `npm test -- src/install.test.ts`
Expected: PASS

### Task 4: Verify the full feature on the real host

**Files:**
- Modify: `src/install.ts`
- Modify: `src/service.ts`
- Modify: `src/cli.ts`

**Step 1: Run targeted tests**

Run:
- `npm test -- src/install.test.ts`
- `npm test -- src/service.test.ts`

Expected: PASS

**Step 2: Run the project build**

Run: `npm run build`
Expected: PASS

**Step 3: Refresh the installed service files and restart**

Run:
- `npm run build`
- `node dist/cli.js restart`
- `systemctl --user status codex-telegram-bridge.service --no-pager`

Expected:
- restart succeeds
- service becomes `active (running)`

**Step 4: Validate operator output**

Run:
- `node dist/cli.js status`
- `node dist/cli.js doctor`

Expected: both commands include the new service audit fields and do not regress existing output.
