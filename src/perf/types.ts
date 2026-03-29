export type PerformanceSampleTarget = "bridge" | "app_server" | "app_server_guard";
export type PerformanceOperationCategory = "app_server_rpc" | "telegram_api";
export type PerformanceOperationOutcome = "ok" | "error" | "timeout";
export type PerformanceTransport = "fetch" | "curl";

export interface PerformanceSampleEvent {
  ts: string;
  kind: "sample";
  target: PerformanceSampleTarget;
  pid: number;
  sampleIntervalMs: number;
  cpuCorePct: number;
  rssBytes: number;
  uptimeSec: number;
  heapUsedBytes?: number;
  heapTotalBytes?: number;
  externalBytes?: number;
  arrayBuffersBytes?: number;
  eventLoopDelayMeanMs?: number;
  eventLoopDelayP95Ms?: number;
  eventLoopDelayMaxMs?: number;
  mcpWorkerCount?: number;
  appServerSubtreeRssBytes?: number;
}

export interface PerformanceOperationEvent {
  ts: string;
  kind: "operation";
  category: PerformanceOperationCategory;
  name: string;
  durationMs: number;
  outcome: PerformanceOperationOutcome;
  pid: number | null;
  transport?: PerformanceTransport;
  errorCode?: number | null;
  retryAfterSeconds?: number | null;
}

export type PerformanceEvent = PerformanceSampleEvent | PerformanceOperationEvent;
