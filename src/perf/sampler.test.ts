import test from "node:test";
import assert from "node:assert/strict";

import { PerformanceSampler } from "./sampler.js";

test("PerformanceSampler records bridge and app-server samples and follows pid changes", async () => {
  const samples: Array<{ target: string; pid: number }> = [];
  let appServerPid = 200;

  const sampler = new PerformanceSampler({
    platform: "linux",
    sampleIntervalMs: 15_000,
    logger: {
      warn: async () => {}
    },
    recorder: {
      recordSample: async (event) => {
        samples.push({ target: event.target, pid: event.pid });
      },
      recordOperation: async () => {}
    },
    getAppServerPid: () => appServerPid,
    readBridgeSnapshot: async () => ({
      cpuCorePct: 10,
      rssBytes: 1000,
      uptimeSec: 20,
      heapUsedBytes: 500,
      heapTotalBytes: 900,
      externalBytes: 20,
      arrayBuffersBytes: 10,
      eventLoopDelayMeanMs: 2,
      eventLoopDelayP95Ms: 3,
      eventLoopDelayMaxMs: 4
    }),
    readAppServerSnapshot: async (pid) => ({
      pid,
      cpuCorePct: 20,
      rssBytes: 2000,
      uptimeSec: 30
    })
  });

  await sampler.sampleNow();
  appServerPid = 201;
  await sampler.sampleNow();

  assert.deepEqual(samples, [
    { target: "bridge", pid: process.pid },
    { target: "app_server", pid: 200 },
    { target: "bridge", pid: process.pid },
    { target: "app_server", pid: 201 }
  ]);
});

test("PerformanceSampler logs warnings instead of throwing when sampling fails", async () => {
  const warnings: string[] = [];
  const sampler = new PerformanceSampler({
    platform: "linux",
    sampleIntervalMs: 15_000,
    logger: {
      warn: async (message) => {
        warnings.push(message);
      }
    },
    recorder: {
      recordSample: async () => {},
      recordOperation: async () => {}
    },
    getAppServerPid: () => null,
    readBridgeSnapshot: async () => {
      throw new Error("boom");
    }
  });

  await sampler.sampleNow();

  assert.deepEqual(warnings, ["performance sampling failed"]);
});

test("PerformanceSampler skips overlapping interval samples", async () => {
  let intervalHandler: (() => void) | null = null;
  let releaseRead: (() => void) | null = null;
  let bridgeReads = 0;
  let bridgeSampleWrites = 0;

  const sampler = new PerformanceSampler({
    platform: "linux",
    sampleIntervalMs: 15_000,
    logger: {
      warn: async () => {}
    },
    recorder: {
      recordSample: async () => {
        bridgeSampleWrites += 1;
      },
      recordOperation: async () => {}
    },
    getAppServerPid: () => null,
    readBridgeSnapshot: async () => {
      bridgeReads += 1;
      await new Promise<void>((resolve) => {
        releaseRead = resolve;
      });
      return {
        cpuCorePct: 10,
        rssBytes: 1000,
        uptimeSec: 20,
        heapUsedBytes: 500,
        heapTotalBytes: 900,
        externalBytes: 20,
        arrayBuffersBytes: 10,
        eventLoopDelayMeanMs: 2,
        eventLoopDelayP95Ms: 3,
        eventLoopDelayMaxMs: 4
      };
    },
    setIntervalFn: ((handler: () => void) => {
      intervalHandler = handler;
      return { unref() {} } as any;
    }) as any,
    clearIntervalFn: (() => {}) as any
  });

  sampler.start();
  assert.equal(bridgeReads, 1);

  assert.ok(intervalHandler);
  const tick = intervalHandler as () => void;
  tick();
  assert.equal(bridgeReads, 1);

  assert.ok(releaseRead);
  const release = releaseRead as () => void;
  release();
  await sampler.sampleNow();

  assert.equal(bridgeReads, 1);
  assert.equal(bridgeSampleWrites, 1);
  sampler.stop();
});
