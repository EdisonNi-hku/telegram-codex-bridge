import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { BridgeConfig } from "../config.js";
import type { BridgePaths } from "../paths.js";
import type { PerformanceEvent, PerformanceOperationEvent, PerformanceSampleEvent } from "./types.js";

interface BuildPerformanceReportOptions {
  paths: Pick<BridgePaths, "perfLogsDir">;
  config: Pick<BridgeConfig, "perfMonitorEnabled">;
  windowMs: number;
  now?: Date;
  platform?: NodeJS.Platform;
}

export function parseReportWindowMs(value: string): number | null {
  const match = /^(\d+)([mhd])$/u.exec(value.trim());
  if (!match) {
    return null;
  }

  const amountText = match[1];
  const unit = match[2];
  if (!amountText || !unit) {
    return null;
  }

  const amount = Number.parseInt(amountText, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit === "m") {
    return amount * 60 * 1000;
  }
  if (unit === "h") {
    return amount * 60 * 60 * 1000;
  }
  if (unit === "d") {
    return amount * 24 * 60 * 60 * 1000;
  }

  return null;
}

export async function buildPerformanceReport(options: BuildPerformanceReportOptions): Promise<string> {
  const platform = options.platform ?? process.platform;
  const now = options.now ?? new Date();
  const lines = [`perf_monitor_enabled=${options.config.perfMonitorEnabled}`];

  if (platform !== "linux") {
    lines.push("perf_monitor_supported=false");
    lines.push(`perf_logs_dir=${options.paths.perfLogsDir}`);
    return lines.join("\n");
  }

  lines.push("perf_monitor_supported=true");
  lines.push(`window_ms=${options.windowMs}`);
  lines.push(`perf_logs_dir=${options.paths.perfLogsDir}`);

  if (!options.config.perfMonitorEnabled) {
    return lines.join("\n");
  }

  const events = await loadEvents(options.paths.perfLogsDir, now, options.windowMs);
  const samples = events.filter((event): event is PerformanceSampleEvent => event.kind === "sample");
  const operations = events.filter((event): event is PerformanceOperationEvent => event.kind === "operation");
  const bridgeSamples = samples.filter((event) => event.target === "bridge");
  const appServerSamples = samples.filter((event) => event.target === "app_server");
  const appServerRpc = operations.filter((event) => event.category === "app_server_rpc");
  const telegramApi = operations.filter((event) => event.category === "telegram_api");

  lines.push(`sample_count=${samples.length}`);
  lines.push(`operation_count=${operations.length}`);
  lines.push(`bridge_cpu_peak_pct=${maximum(bridgeSamples.map((event) => event.cpuCorePct))}`);
  lines.push(`bridge_rss_peak_bytes=${maximum(bridgeSamples.map((event) => event.rssBytes))}`);
  lines.push(`bridge_heap_peak_bytes=${maximum(bridgeSamples.map((event) => event.heapUsedBytes ?? 0))}`);
  lines.push(`bridge_event_loop_delay_peak_ms=${maximum(bridgeSamples.map((event) => event.eventLoopDelayMaxMs ?? 0))}`);
  lines.push(`app_server_rss_peak_bytes=${maximum(appServerSamples.map((event) => event.rssBytes))}`);
  lines.push(`app_server_rpc_count=${appServerRpc.length}`);
  lines.push(`app_server_rpc_error_count=${appServerRpc.filter((event) => event.outcome === "error").length}`);
  lines.push(`app_server_rpc_timeout_count=${appServerRpc.filter((event) => event.outcome === "timeout").length}`);
  lines.push(`app_server_rpc_p95_ms=${percentile(appServerRpc.map((event) => event.durationMs), 95)}`);
  lines.push(`app_server_rpc_slowest=${slowest(appServerRpc)}`);
  lines.push(`telegram_api_count=${telegramApi.length}`);
  lines.push(`telegram_api_error_count=${telegramApi.filter((event) => event.outcome === "error").length}`);
  lines.push(`telegram_api_timeout_count=${telegramApi.filter((event) => event.outcome === "timeout").length}`);
  lines.push(`telegram_api_p95_ms=${percentile(telegramApi.map((event) => event.durationMs), 95)}`);
  lines.push(`telegram_api_slowest=${slowest(telegramApi)}`);

  return lines.join("\n");
}

async function loadEvents(perfLogsDir: string, now: Date, windowMs: number): Promise<PerformanceEvent[]> {
  let fileNames: string[] = [];

  try {
    fileNames = await readdir(perfLogsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const minTime = now.getTime() - windowMs;
  const maxTime = now.getTime();
  const events: PerformanceEvent[] = [];

  for (const fileName of fileNames) {
    if (!fileName.endsWith(".jsonl")) {
      continue;
    }

    const content = await readFile(join(perfLogsDir, fileName), "utf8");
    for (const line of content.split(/\r?\n/u)) {
      if (!line.trim()) {
        continue;
      }

      try {
        const event = JSON.parse(line) as PerformanceEvent;
        const timestamp = Date.parse(event.ts);
        if (Number.isNaN(timestamp) || timestamp < minTime || timestamp > maxTime) {
          continue;
        }
        events.push(event);
      } catch {
        continue;
      }
    }
  }

  return events;
}

function maximum(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return round(Math.max(...values));
}

function percentile(values: number[], value: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return round(sorted[Math.min(index, sorted.length - 1)] ?? 0);
}

function slowest(events: PerformanceOperationEvent[]): string {
  if (events.length === 0) {
    return "none";
  }

  const [event] = [...events].sort((left, right) => right.durationMs - left.durationMs);
  if (!event) {
    return "none";
  }
  return `${event.name}:${round(event.durationMs)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
