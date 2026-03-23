import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PerformanceJournal } from "./journal.js";

test("PerformanceJournal writes dated JSONL events and prunes expired log files", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-perf-journal-test-"));
  const perfLogsDir = join(root, "logs", "perf");

  try {
    await mkdir(perfLogsDir, { recursive: true });
    const journal = new PerformanceJournal({
      perfLogsDir,
      retentionDays: 7,
      now: () => new Date("2026-03-23T12:00:00.000Z")
    });

    await writeFile(
      join(perfLogsDir, "2026-03-10.jsonl"),
      '{"ts":"2026-03-10T12:00:00.000Z","kind":"sample"}\n',
      "utf8"
    );

    await journal.appendEvent({
      ts: "2026-03-23T12:00:00.000Z",
      kind: "sample",
      target: "bridge",
      pid: process.pid,
      sampleIntervalMs: 15_000,
      cpuCorePct: 12.5,
      rssBytes: 1024,
      uptimeSec: 10
    } as any);

    await journal.pruneExpiredLogs();

    const content = await readFile(join(perfLogsDir, "2026-03-23.jsonl"), "utf8");
    assert.match(content, /"target":"bridge"/u);
    await assert.rejects(access(join(perfLogsDir, "2026-03-10.jsonl")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
