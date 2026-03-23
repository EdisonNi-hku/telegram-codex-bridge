import { nowIso } from "../util/time.js";
import { PerformanceJournal } from "./journal.js";
import type { PerformanceOperationEvent, PerformanceSampleEvent } from "./types.js";

export interface PerformanceRecorder {
  recordSample(event: Omit<PerformanceSampleEvent, "ts" | "kind"> & { ts?: string }): Promise<void>;
  recordOperation(event: Omit<PerformanceOperationEvent, "ts" | "kind"> & { ts?: string }): Promise<void>;
}

export class JsonlPerformanceRecorder implements PerformanceRecorder {
  constructor(private readonly journal: PerformanceJournal) {}

  async recordSample(event: Omit<PerformanceSampleEvent, "ts" | "kind"> & { ts?: string }): Promise<void> {
    await this.journal.appendEvent({
      ts: event.ts ?? nowIso(),
      kind: "sample",
      ...event
    });
  }

  async recordOperation(event: Omit<PerformanceOperationEvent, "ts" | "kind"> & { ts?: string }): Promise<void> {
    await this.journal.appendEvent({
      ts: event.ts ?? nowIso(),
      kind: "operation",
      ...event
    });
  }
}

export const noopPerformanceRecorder: PerformanceRecorder = {
  recordSample: async () => {},
  recordOperation: async () => {}
};
