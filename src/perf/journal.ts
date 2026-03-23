import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { PerformanceEvent } from "./types.js";
import { parsePerformanceLogDate } from "./log-date.js";

interface PerformanceJournalOptions {
  perfLogsDir: string;
  retentionDays: number;
  now?: () => Date;
}

export class PerformanceJournal {
  private readonly now: () => Date;
  private ensureDirPromise: Promise<void> | null = null;

  constructor(private readonly options: PerformanceJournalOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async appendEvent(event: PerformanceEvent): Promise<void> {
    await this.ensurePerfLogsDir();
    const filePath = join(this.options.perfLogsDir, `${event.ts.slice(0, 10)}.jsonl`);
    await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  async pruneExpiredLogs(referenceDate = this.now()): Promise<void> {
    await this.ensurePerfLogsDir();
    const entries = await readdir(this.options.perfLogsDir, { withFileTypes: true });
    const cutoff = new Date(Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    ));
    cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(this.options.retentionDays - 1, 0));

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
        continue;
      }

      const dated = parsePerformanceLogDate(entry.name);
      if (!dated || dated >= cutoff) {
        continue;
      }

      await rm(join(this.options.perfLogsDir, entry.name), { force: true });
    }
  }

  private async ensurePerfLogsDir(): Promise<void> {
    if (!this.ensureDirPromise) {
      this.ensureDirPromise = mkdir(this.options.perfLogsDir, { recursive: true })
        .then(() => {})
        .catch((error) => {
          this.ensureDirPromise = null;
          throw error;
        });
    }

    await this.ensureDirPromise;
  }
}
