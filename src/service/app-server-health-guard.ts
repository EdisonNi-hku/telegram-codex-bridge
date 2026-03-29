import { readdir, readFile } from "node:fs/promises";

interface GuardLogger {
  info(message: string, meta?: Record<string, unknown>): Promise<void> | void;
  warn(message: string, meta?: Record<string, unknown>): Promise<void> | void;
}

export interface AppServerHealthSnapshot {
  mcpWorkerCount: number;
  subtreeRssBytes: number;
}

export interface AppServerHealthGuardOptions {
  platform?: NodeJS.Platform;
  enabled: boolean;
  sampleIntervalMs: number;
  mcpWorkerThreshold: number;
  consecutiveWindows: number;
  cooldownMs: number;
  logger: GuardLogger;
  getAppServerPid: () => number | null;
  canRecycleNow: () => boolean;
  recycleAppServer: () => Promise<void>;
  readHealthSnapshot?: (appServerPid: number) => Promise<AppServerHealthSnapshot | null>;
  onSample?: (sample: { pid: number; mcpWorkerCount: number; subtreeRssBytes: number }) => Promise<void> | void;
  now?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export interface AppServerHealthGuardLike {
  start(): void;
  stop(): void;
  sampleNow(): Promise<void>;
}

export class AppServerHealthGuard implements AppServerHealthGuardLike {
  private readonly platform: NodeJS.Platform;
  private readonly now: () => number;
  private readonly readHealthSnapshot: (appServerPid: number) => Promise<AppServerHealthSnapshot | null>;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private timer: ReturnType<typeof setInterval> | null = null;
  private samplePromise: Promise<void> | null = null;
  private recycleInFlight = false;
  private consecutiveBreaches = 0;
  private lastRecycleAt: number | null = null;

  constructor(private readonly options: AppServerHealthGuardOptions) {
    this.platform = options.platform ?? process.platform;
    this.now = options.now ?? (() => Date.now());
    this.readHealthSnapshot = options.readHealthSnapshot ?? readLinuxAppServerHealthSnapshot;
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  }

  start(): void {
    if (!this.isEnabled() || this.timer) {
      return;
    }

    void this.sampleNow();
    this.timer = this.setIntervalFn(() => {
      void this.sampleNow();
    }, this.options.sampleIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    this.clearIntervalFn(this.timer);
    this.timer = null;
  }

  async sampleNow(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    if (this.samplePromise) {
      return await this.samplePromise;
    }

    const samplePromise = this.runSample().catch(async (error) => {
      await this.options.logger.warn("app-server health sampling failed", {
        error: `${error}`,
        code: (error as NodeJS.ErrnoException).code ?? null
      });
    }).finally(() => {
      if (this.samplePromise === samplePromise) {
        this.samplePromise = null;
      }
    });
    this.samplePromise = samplePromise;
    return await samplePromise;
  }

  private isEnabled(): boolean {
    return this.options.enabled && this.platform === "linux";
  }

  private async runSample(): Promise<void> {
    const appServerPid = this.options.getAppServerPid();
    if (appServerPid === null) {
      this.consecutiveBreaches = 0;
      return;
    }

    const snapshot = await this.readHealthSnapshot(appServerPid);
    if (!snapshot) {
      this.consecutiveBreaches = 0;
      return;
    }

    await this.options.onSample?.({
      pid: appServerPid,
      mcpWorkerCount: snapshot.mcpWorkerCount,
      subtreeRssBytes: snapshot.subtreeRssBytes
    });

    if (snapshot.mcpWorkerCount > this.options.mcpWorkerThreshold) {
      this.consecutiveBreaches += 1;
    } else {
      this.consecutiveBreaches = 0;
      return;
    }

    if (this.consecutiveBreaches < this.options.consecutiveWindows) {
      return;
    }
    if (this.recycleInFlight) {
      return;
    }

    const nowMs = this.now();
    if (this.lastRecycleAt !== null && nowMs - this.lastRecycleAt < this.options.cooldownMs) {
      return;
    }
    if (!this.options.canRecycleNow()) {
      await this.options.logger.warn("app-server recycle skipped because bridge is busy", {
        appServerPid,
        mcpWorkerCount: snapshot.mcpWorkerCount,
        threshold: this.options.mcpWorkerThreshold
      });
      this.consecutiveBreaches = this.options.consecutiveWindows;
      return;
    }

    this.recycleInFlight = true;
    try {
      await this.options.logger.warn("app-server recycle triggered by health guard", {
        appServerPid,
        mcpWorkerCount: snapshot.mcpWorkerCount,
        threshold: this.options.mcpWorkerThreshold,
        consecutiveBreaches: this.consecutiveBreaches
      });
      await this.options.recycleAppServer();
      this.lastRecycleAt = nowMs;
      this.consecutiveBreaches = 0;
      await this.options.logger.info("app-server recycle completed", {
        appServerPid
      });
    } catch (error) {
      await this.options.logger.warn("app-server recycle failed", {
        appServerPid,
        error: `${error}`
      });
    } finally {
      this.recycleInFlight = false;
    }
  }
}

interface LinuxProcStat {
  pid: number;
  ppid: number;
  rssBytes: number;
}

const PAGE_SIZE_BYTES = 4096;

export async function readLinuxAppServerHealthSnapshot(rootPid: number): Promise<AppServerHealthSnapshot | null> {
  const stats = await readLinuxProcessStats();
  if (!stats.has(rootPid)) {
    return null;
  }

  const descendants = collectDescendantPids(rootPid, stats);
  let subtreeRssBytes = 0;
  let mcpWorkerCount = 0;

  await Promise.all(descendants.map(async (pid) => {
    const stat = stats.get(pid);
    if (!stat) {
      return;
    }
    subtreeRssBytes += stat.rssBytes;

    if (pid === rootPid) {
      return;
    }

    const cmdline = await readProcCmdline(pid);
    if (isMcpWorkerCommand(cmdline)) {
      mcpWorkerCount += 1;
    }
  }));

  return {
    mcpWorkerCount,
    subtreeRssBytes
  };
}

async function readLinuxProcessStats(): Promise<Map<number, LinuxProcStat>> {
  const entries = await readdir("/proc", { withFileTypes: true });
  const stats = new Map<number, LinuxProcStat>();

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory() || !/^\d+$/u.test(entry.name)) {
      return;
    }
    const pid = Number.parseInt(entry.name, 10);
    if (!Number.isFinite(pid)) {
      return;
    }
    try {
      const statText = await readFile(`/proc/${pid}/stat`, "utf8");
      const parsed = parseLinuxProcessStat(statText);
      stats.set(pid, {
        pid,
        ppid: parsed.ppid,
        rssBytes: parsed.rssPages * PAGE_SIZE_BYTES
      });
    } catch (error) {
      if (isIgnorableProcRace(error)) {
        return;
      }
      throw error;
    }
  }));

  return stats;
}

function parseLinuxProcessStat(statText: string): { ppid: number; rssPages: number } {
  const closingParen = statText.lastIndexOf(")");
  const fields = statText.slice(closingParen + 2).trim().split(/\s+/u);
  const ppid = Number.parseInt(fields[1] ?? "0", 10);
  const rssPages = Number.parseInt(fields[21] ?? "0", 10);
  return {
    ppid,
    rssPages
  };
}

function collectDescendantPids(rootPid: number, stats: Map<number, LinuxProcStat>): number[] {
  const childrenByParent = new Map<number, number[]>();
  for (const stat of stats.values()) {
    const existing = childrenByParent.get(stat.ppid) ?? [];
    existing.push(stat.pid);
    childrenByParent.set(stat.ppid, existing);
  }

  const queue = [rootPid];
  const visited = new Set<number>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || visited.has(current)) {
      continue;
    }
    visited.add(current);
    const children = childrenByParent.get(current) ?? [];
    for (const child of children) {
      if (!visited.has(child)) {
        queue.push(child);
      }
    }
  }

  return [...visited];
}

async function readProcCmdline(pid: number): Promise<string> {
  try {
    const cmdline = await readFile(`/proc/${pid}/cmdline`, "utf8");
    return cmdline.replace(/\u0000+/gu, " ").trim();
  } catch (error) {
    if (isIgnorableProcRace(error)) {
      return "";
    }
    throw error;
  }
}

function isMcpWorkerCommand(command: string): boolean {
  if (!command) {
    return false;
  }

  return command.includes("grok-search")
    || command.includes("/package/dist/index.js");
}

function isIgnorableProcRace(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ESRCH";
}
