# Performance Monitoring Tool Implementation Plan

> Archived material: historical reconstruction only. Do not treat this file as current truth or an executable task prompt. Start from current docs or `docs/roadmap/codex-console-continuation-brief.md` instead.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Linux-first, low-overhead, always-on performance monitoring tool to `telegram-codex-bridge` that records bridge and `codex app-server` performance data and exposes recent summaries through the CLI.

**Architecture:** The bridge will gain an internal performance subsystem that writes structured JSONL sample and operation events into a dedicated perf log directory. The long-lived service will own sampling for the bridge process and the active app-server child process, while shared wrappers around app-server RPCs and Telegram API calls will emit duration events. A new `ctb perf report` command will read recent perf logs and generate an operator-friendly summary.

**Tech Stack:** Node.js 24+, TypeScript, Linux `/proc`, `perf_hooks.monitorEventLoopDelay()`, JSONL structured logs, existing `ctb` CLI

---

## Summary

First implementation target:

- Continuously sample bridge and app-server CPU, RSS, heap, and event-loop metrics
- Record app-server RPC and Telegram API durations as structured operation events
- Add `ctb perf report [--window <duration>]` for recent summaries
- Keep the feature Linux-first and default-disabled
- Execute all work in the `feat/perf-monitoring-tool` branch under `.worktrees/perf-monitoring-tool`

## Key Changes

### Perf subsystem

- Add a new `src/perf/` subsystem with four collaborators:
  - `PerformanceRecorder`
  - `PerformanceSampler`
  - `PerformanceJournal`
  - `PerformanceReport`
- Write perf logs to `~/.local/state/codex-telegram-bridge/logs/perf/YYYY-MM-DD.jsonl`
- Support two event families:
  - `sample`
  - `operation`

### Sampling scope

- Sample the bridge process with:
  - `process.memoryUsage()`
  - `process.cpuUsage()`
  - `process.uptime()`
  - `perf_hooks.monitorEventLoopDelay()`
- Sample the app-server child on Linux using the existing `CodexAppServerClient.pid` plus `/proc`
- Track PID changes so sampling follows app-server restarts automatically
- Default sample interval: `15000ms`
- Default log retention: `7` days

### Operation instrumentation

- Record `app_server_rpc` events in `CodexAppServerClient.request()`
- Record `telegram_api` events in `TelegramApi` request paths, including `curl` fallback
- Capture operation name, duration, success/error/timeout outcome, and transport-specific metadata
- Do not add per-statement SQLite instrumentation in v1

### Configuration and CLI

- Extend `BridgeConfig` with:
  - `PERF_MONITOR_ENABLED`
  - `PERF_MONITOR_SAMPLE_INTERVAL_MS`
  - `PERF_MONITOR_RETENTION_DAYS`
- Extend install/config plumbing so operators can enable perf monitoring without hand-editing only
- Extend `BridgePaths` with `perfLogsDir`
- Add `ctb perf report [--window <duration>]`
- Support report windows like `5m`, `1h`, `24h`, `7d`, defaulting to `1h`

### Service behavior

- Start the perf sampler during bridge startup after core service initialization
- Keep perf failures non-fatal and log them as warnings to the existing bridge logger
- Run retention cleanup at startup and periodically afterward
- Keep non-Linux behavior as no-op plus explicit unsupported messaging from the report command

### Worktree workflow

- Create and use a dedicated worktree at `.worktrees/perf-monitoring-tool`
- Implement on branch `feat/perf-monitoring-tool` branched from `master`
- After implementation and verification, ask the user whether to merge worktree changes back into `master`
- Do not auto-merge without explicit user confirmation

## Test Plan

- Add focused tests for config parsing and writing of perf settings
- Add focused tests for perf log path generation and retention cleanup
- Add focused tests for app-server request instrumentation, including success and timeout outcomes
- Add focused tests for Telegram API instrumentation across fetch success, curl fallback, and failure flows
- Add focused tests for report generation with populated logs, empty logs, disabled monitoring, and unsupported platform behavior
- Add service-level tests proving bridge sampling starts, app-server sampling follows PID changes, and perf subsystem failures stay non-fatal
- Before completion in the worktree, run:
  - `npm run check`
  - targeted perf-related tests
  - `npm test`
- If the user chooses to merge into `master`, rerun the verification suite after merge

## Assumptions

- The target integration branch is `master`
- The implementation is Linux-first for child-process resource sampling
- Perf monitoring is default-disabled to avoid introducing silent always-on overhead
- The initial operator surface is CLI plus raw JSONL logs, not Telegram UI and not Prometheus
- `node --cpu-prof`, `--heap-prof`, and `perf` remain complementary tools for deeper investigation, not replaced by this feature
