import type { PerformanceRecorder } from "./recorder.js";
import { createBridgeSnapshotReader, createLinuxProcessSnapshotReader } from "./linux-readers.js";

interface BridgeSnapshot {
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
}

interface AppServerSnapshot {
  pid: number;
  cpuCorePct: number;
  rssBytes: number;
  uptimeSec: number;
}

interface WarnLogger {
  warn(message: string, meta?: Record<string, unknown>): Promise<void> | void;
}

export interface PerformanceSamplerOptions {
  platform?: NodeJS.Platform;
  sampleIntervalMs: number;
  logger: WarnLogger;
  recorder: PerformanceRecorder;
  getAppServerPid: () => number | null;
  readBridgeSnapshot?: () => Promise<BridgeSnapshot>;
  readAppServerSnapshot?: (pid: number) => Promise<AppServerSnapshot | null>;
  pruneLogs?: () => Promise<void>;
  pruneIntervalMs?: number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export interface PerformanceSamplerLike {
  start(): void;
  stop(): void;
}

export class PerformanceSampler implements PerformanceSamplerLike {
  private readonly platform: NodeJS.Platform;
  private readonly readBridgeSnapshot: () => Promise<BridgeSnapshot>;
  private readonly readAppServerSnapshot: (pid: number) => Promise<AppServerSnapshot | null>;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly pruneIntervalMs: number;
  private readonly disposeReaders: () => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private samplePromise: Promise<void> | null = null;
  private lastPruneAt = 0;

  constructor(private readonly options: PerformanceSamplerOptions) {
    const bridgeSnapshotReader = createBridgeSnapshotReader();
    const appServerSnapshotReader = createLinuxProcessSnapshotReader();
    this.platform = options.platform ?? process.platform;
    this.readBridgeSnapshot = options.readBridgeSnapshot ?? (() => bridgeSnapshotReader.read());
    this.readAppServerSnapshot = options.readAppServerSnapshot ?? ((pid) => appServerSnapshotReader.read(pid));
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    this.pruneIntervalMs = options.pruneIntervalMs ?? 60 * 60 * 1000;
    this.disposeReaders = options.readBridgeSnapshot || options.readAppServerSnapshot
      ? () => {}
      : () => bridgeSnapshotReader.dispose();
  }

  start(): void {
    if (this.platform !== "linux" || this.timer) {
      return;
    }

    void this.requestSample();
    this.timer = this.setIntervalFn(() => {
      void this.requestSample();
    }, this.options.sampleIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) {
      this.disposeReaders();
      return;
    }

    this.clearIntervalFn(this.timer);
    this.timer = null;
    this.disposeReaders();
  }

  async sampleNow(): Promise<void> {
    await this.requestSample();
  }

  private requestSample(): Promise<void> {
    if (this.samplePromise) {
      return this.samplePromise;
    }

    const samplePromise = this.runSample().finally(() => {
      if (this.samplePromise === samplePromise) {
        this.samplePromise = null;
      }
    });
    this.samplePromise = samplePromise;
    return samplePromise;
  }

  private async runSample(): Promise<void> {
    if (this.platform !== "linux") {
      return;
    }

    try {
      const bridge = await this.readBridgeSnapshot();
      await this.options.recorder.recordSample({
        target: "bridge",
        pid: process.pid,
        sampleIntervalMs: this.options.sampleIntervalMs,
        ...bridge
      });

      const appServerPid = this.options.getAppServerPid();
      if (appServerPid !== null) {
        const appServer = await this.readAppServerSnapshot(appServerPid);
        if (appServer) {
          await this.options.recorder.recordSample({
            target: "app_server",
            pid: appServer.pid,
            sampleIntervalMs: this.options.sampleIntervalMs,
            cpuCorePct: appServer.cpuCorePct,
            rssBytes: appServer.rssBytes,
            uptimeSec: appServer.uptimeSec
          });
        }
      }

      if (this.options.pruneLogs && shouldPrune(Date.now(), this.lastPruneAt, this.pruneIntervalMs)) {
        this.lastPruneAt = Date.now();
        await this.options.pruneLogs();
      }
    } catch (error) {
      await this.options.logger.warn("performance sampling failed", {
        error: `${error}`
      });
    }
  }
}

function shouldPrune(nowMs: number, lastPruneAt: number, pruneIntervalMs: number): boolean {
  return lastPruneAt === 0 || nowMs - lastPruneAt >= pruneIntervalMs;
}
