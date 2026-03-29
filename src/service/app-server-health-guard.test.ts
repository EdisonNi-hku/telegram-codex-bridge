import test from "node:test";
import assert from "node:assert/strict";

import { AppServerHealthGuard } from "./app-server-health-guard.js";

test("AppServerHealthGuard triggers recycle after consecutive threshold breaches when idle", async () => {
  const recycleCalls: number[] = [];
  let nowMs = 0;
  const guard = new AppServerHealthGuard({
    platform: "linux",
    enabled: true,
    sampleIntervalMs: 10_000,
    mcpWorkerThreshold: 2,
    consecutiveWindows: 3,
    cooldownMs: 60_000,
    logger: {
      info: async () => {},
      warn: async () => {}
    },
    getAppServerPid: () => 100,
    canRecycleNow: () => true,
    recycleAppServer: async () => {
      recycleCalls.push(nowMs);
    },
    now: () => nowMs,
    readHealthSnapshot: async () => ({
      mcpWorkerCount: 3,
      subtreeRssBytes: 1234
    })
  });

  await guard.sampleNow();
  await guard.sampleNow();
  assert.equal(recycleCalls.length, 0);

  await guard.sampleNow();
  assert.equal(recycleCalls.length, 1);
  assert.equal(recycleCalls[0], 0);
});

test("AppServerHealthGuard skips recycle while busy and retries once idle", async () => {
  const recycleCalls: number[] = [];
  const warnings: string[] = [];
  let busy = true;
  const guard = new AppServerHealthGuard({
    platform: "linux",
    enabled: true,
    sampleIntervalMs: 10_000,
    mcpWorkerThreshold: 1,
    consecutiveWindows: 2,
    cooldownMs: 60_000,
    logger: {
      info: async () => {},
      warn: async (message) => {
        warnings.push(message);
      }
    },
    getAppServerPid: () => 100,
    canRecycleNow: () => !busy,
    recycleAppServer: async () => {
      recycleCalls.push(1);
    },
    readHealthSnapshot: async () => ({
      mcpWorkerCount: 5,
      subtreeRssBytes: 2048
    })
  });

  await guard.sampleNow();
  await guard.sampleNow();
  assert.equal(recycleCalls.length, 0);
  assert.equal(warnings.includes("app-server recycle skipped because bridge is busy"), true);

  busy = false;
  await guard.sampleNow();
  assert.equal(recycleCalls.length, 1);
});

test("AppServerHealthGuard enforces cooldown between recycle attempts", async () => {
  const recycleCalls: number[] = [];
  let nowMs = 0;
  const guard = new AppServerHealthGuard({
    platform: "linux",
    enabled: true,
    sampleIntervalMs: 10_000,
    mcpWorkerThreshold: 1,
    consecutiveWindows: 1,
    cooldownMs: 60_000,
    logger: {
      info: async () => {},
      warn: async () => {}
    },
    getAppServerPid: () => 100,
    canRecycleNow: () => true,
    recycleAppServer: async () => {
      recycleCalls.push(nowMs);
    },
    now: () => nowMs,
    readHealthSnapshot: async () => ({
      mcpWorkerCount: 4,
      subtreeRssBytes: 3000
    })
  });

  await guard.sampleNow();
  assert.equal(recycleCalls.length, 1);

  nowMs = 30_000;
  await guard.sampleNow();
  assert.equal(recycleCalls.length, 1);

  nowMs = 61_000;
  await guard.sampleNow();
  assert.equal(recycleCalls.length, 2);
});

test("AppServerHealthGuard logs sampling races instead of throwing when process entries disappear", async () => {
  const warnings: string[] = [];
  const guard = new AppServerHealthGuard({
    platform: "linux",
    enabled: true,
    sampleIntervalMs: 10_000,
    mcpWorkerThreshold: 1,
    consecutiveWindows: 1,
    cooldownMs: 60_000,
    logger: {
      info: async () => {},
      warn: async (message) => {
        warnings.push(message);
      }
    },
    getAppServerPid: () => 100,
    canRecycleNow: () => true,
    recycleAppServer: async () => {},
    readHealthSnapshot: async () => {
      const error = new Error("process vanished");
      (error as NodeJS.ErrnoException).code = "ESRCH";
      throw error;
    }
  });

  await assert.doesNotReject(async () => {
    await guard.sampleNow();
  });
  assert.equal(warnings.includes("app-server health sampling failed"), true);
});
