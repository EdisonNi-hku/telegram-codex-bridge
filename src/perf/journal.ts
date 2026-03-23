import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { PerformanceEvent } from "./types.js";

interface PerformanceJournalOptions {
  perfLogsDir: string;
  retentionDays: number;
  now?: () => Date;
}

export class PerformanceJournal {
  private readonly now: () => Date;

  constructor(private readonly options: PerformanceJournalOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async appendEvent(event: PerformanceEvent): Promise<void> {
    await mkdir(this.options.perfLogsDir, { recursive: true });
    const filePath = join(this.options.perfLogsDir, `${event.ts.slice(0, 10)}.jsonl`);
    await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  async pruneExpiredLogs(referenceDate = this.now()): Promise<void> {
    await mkdir(this.options.perfLogsDir, { recursive: true });
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

      const dated = parseLogDate(entry.name);
      if (!dated || dated >= cutoff) {
        continue;
      }

      await rm(join(this.options.perfLogsDir, entry.name), { force: true });
    }
  }
}

function parseLogDate(fileName: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})\.jsonl$/u.exec(fileName);
  if (!match) {
    return null;
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
