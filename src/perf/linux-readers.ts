import { readFile } from "node:fs/promises";
import { monitorEventLoopDelay } from "node:perf_hooks";

interface BridgeSnapshot {
  cpuCorePct: number;
  rssBytes: number;
  uptimeSec: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
  eventLoopDelayMeanMs: number;
  eventLoopDelayP95Ms: number;
  eventLoopDelayMaxMs: number;
}

interface AppServerSnapshot {
  pid: number;
  cpuCorePct: number;
  rssBytes: number;
  uptimeSec: number;
}

interface BridgeSnapshotReader {
  read(): Promise<BridgeSnapshot>;
  dispose(): void;
}

interface AppServerSnapshotReader {
  read(pid: number): Promise<AppServerSnapshot | null>;
}

const DEFAULT_CLOCK_TICKS_PER_SECOND = 100;
const DEFAULT_PAGE_SIZE_BYTES = 4096;

export function createBridgeSnapshotReader(): BridgeSnapshotReader {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  let previousCpuUsage = process.cpuUsage();
  let previousAtMs = Date.now();

  return {
    async read(): Promise<BridgeSnapshot> {
      const nowMs = Date.now();
      const currentCpuUsage = process.cpuUsage();
      const cpuMicros = (currentCpuUsage.user - previousCpuUsage.user) + (currentCpuUsage.system - previousCpuUsage.system);
      const elapsedMs = Math.max(nowMs - previousAtMs, 1);
      previousCpuUsage = currentCpuUsage;
      previousAtMs = nowMs;

      const memory = process.memoryUsage();
      const snapshot: BridgeSnapshot = {
        cpuCorePct: round((cpuMicros / 1000 / elapsedMs) * 100),
        rssBytes: memory.rss,
        uptimeSec: round(process.uptime()),
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
        arrayBuffersBytes: memory.arrayBuffers,
        eventLoopDelayMeanMs: round(histogram.mean / 1_000_000),
        eventLoopDelayP95Ms: round(histogram.percentile(95) / 1_000_000),
        eventLoopDelayMaxMs: round(histogram.max / 1_000_000)
      };
      histogram.reset();
      return snapshot;
    },
    dispose(): void {
      histogram.disable();
    }
  };
}

export function createLinuxProcessSnapshotReader(): AppServerSnapshotReader {
  const previousByPid = new Map<number, { totalTicks: number; atMs: number }>();

  return {
    async read(pid: number): Promise<AppServerSnapshot | null> {
      try {
        const [statText, uptimeText] = await Promise.all([
          readFile(`/proc/${pid}/stat`, "utf8"),
          readFile("/proc/uptime", "utf8")
        ]);

        const parsed = parseLinuxProcessStat(pid, statText, uptimeText);
        const nowMs = Date.now();
        const previous = previousByPid.get(pid);
        const cpuCorePct = previous
          ? round((((parsed.totalTicks - previous.totalTicks) / DEFAULT_CLOCK_TICKS_PER_SECOND) / Math.max((nowMs - previous.atMs) / 1000, 0.001)) * 100)
          : 0;
        previousByPid.set(pid, {
          totalTicks: parsed.totalTicks,
          atMs: nowMs
        });

        return {
          pid,
          cpuCorePct,
          rssBytes: parsed.rssBytes,
          uptimeSec: parsed.uptimeSec
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          previousByPid.delete(pid);
          return null;
        }
        throw error;
      }
    }
  };
}

function parseLinuxProcessStat(pid: number, statText: string, uptimeText: string): {
  pid: number;
  totalTicks: number;
  rssBytes: number;
  uptimeSec: number;
} {
  const closingParen = statText.lastIndexOf(")");
  const fields = statText.slice(closingParen + 2).trim().split(/\s+/u);
  const utime = Number.parseInt(fields[11] ?? "0", 10);
  const stime = Number.parseInt(fields[12] ?? "0", 10);
  const startTimeTicks = Number.parseInt(fields[19] ?? "0", 10);
  const rssPages = Number.parseInt(fields[21] ?? "0", 10);
  const systemUptimeSec = Number.parseFloat(uptimeText.split(/\s+/u)[0] ?? "0");

  return {
    pid,
    totalTicks: utime + stime,
    rssBytes: rssPages * DEFAULT_PAGE_SIZE_BYTES,
    uptimeSec: round(systemUptimeSec - (startTimeTicks / DEFAULT_CLOCK_TICKS_PER_SECOND))
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
