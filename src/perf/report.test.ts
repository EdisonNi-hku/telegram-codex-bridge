import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPerformanceReport, parseReportWindowMs } from "./report.js";

test("parseReportWindowMs supports minute hour and day suffixes", () => {
  assert.equal(parseReportWindowMs("5m"), 5 * 60 * 1000);
  assert.equal(parseReportWindowMs("1h"), 60 * 60 * 1000);
  assert.equal(parseReportWindowMs("7d"), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseReportWindowMs("bogus"), null);
});

test("buildPerformanceReport summarizes recent samples and operations", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-perf-report-test-"));
  const perfLogsDir = join(root, "logs", "perf");

  try {
    await mkdir(perfLogsDir, { recursive: true });
    await writeFile(
      join(perfLogsDir, "2026-03-23.jsonl"),
      [
        JSON.stringify({
          ts: "2026-03-23T11:55:00.000Z",
          kind: "sample",
          target: "bridge",
          pid: 101,
          sampleIntervalMs: 15_000,
          cpuCorePct: 20,
          rssBytes: 2000,
          heapUsedBytes: 1500,
          eventLoopDelayMaxMs: 12,
          uptimeSec: 30
        }),
        JSON.stringify({
          ts: "2026-03-23T11:55:15.000Z",
          kind: "sample",
          target: "app_server",
          pid: 202,
          sampleIntervalMs: 15_000,
          cpuCorePct: 35,
          rssBytes: 5000,
          uptimeSec: 25
        }),
        JSON.stringify({
          ts: "2026-03-23T11:56:00.000Z",
          kind: "operation",
          category: "app_server_rpc",
          name: "turn/start",
          durationMs: 420,
          outcome: "ok",
          pid: 202
        }),
        JSON.stringify({
          ts: "2026-03-23T11:56:30.000Z",
          kind: "operation",
          category: "telegram_api",
          name: "getMe",
          durationMs: 55,
          outcome: "error",
          pid: 101,
          transport: "curl"
        })
      ].join("\n") + "\n",
      "utf8"
    );

    const report = await buildPerformanceReport({
      paths: { perfLogsDir } as any,
      config: { perfMonitorEnabled: true } as any,
      windowMs: 60 * 60 * 1000,
      now: new Date("2026-03-23T12:00:00.000Z"),
      platform: "linux"
    });

    assert.match(report, /^perf_monitor_enabled=true$/mu);
    assert.match(report, /^sample_count=2$/mu);
    assert.match(report, /^bridge_cpu_peak_pct=20$/mu);
    assert.match(report, /^app_server_rss_peak_bytes=5000$/mu);
    assert.match(report, /^app_server_rpc_count=1$/mu);
    assert.match(report, /^app_server_rpc_p95_ms=420$/mu);
    assert.match(report, /^telegram_api_error_count=1$/mu);
    assert.match(report, /^telegram_api_slowest=getMe:55$/mu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildPerformanceReport returns explicit disabled and unsupported states", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-perf-report-test-"));
  const perfLogsDir = join(root, "logs", "perf");

  try {
    await mkdir(perfLogsDir, { recursive: true });

    const disabled = await buildPerformanceReport({
      paths: { perfLogsDir } as any,
      config: { perfMonitorEnabled: false } as any,
      windowMs: 5 * 60 * 1000,
      now: new Date("2026-03-23T12:00:00.000Z"),
      platform: "linux"
    });
    assert.match(disabled, /^perf_monitor_enabled=false$/mu);

    const unsupported = await buildPerformanceReport({
      paths: { perfLogsDir } as any,
      config: { perfMonitorEnabled: true } as any,
      windowMs: 5 * 60 * 1000,
      now: new Date("2026-03-23T12:00:00.000Z"),
      platform: "darwin"
    });
    assert.match(unsupported, /^perf_monitor_supported=false$/mu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
