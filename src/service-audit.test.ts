import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { captureSystemdStopAudit } from "./service-audit.js";
import type { BridgePaths } from "./paths.js";
import type { CommandResult } from "./process.js";

function createTestPaths(root: string): BridgePaths {
  const logsDir = join(root, "logs");
  const runtimeDir = join(root, "runtime");

  return {
    homeDir: root,
    repoRoot: root,
    installRoot: join(root, "install"),
    stateRoot: join(root, "state"),
    configRoot: join(root, "config"),
    logsDir,
    perfLogsDir: join(logsDir, "perf"),
    telegramSessionFlowLogsDir: join(logsDir, "telegram-session-flow"),
    runtimeDir,
    cacheDir: join(root, "cache"),
    dbPath: join(root, "state", "bridge.db"),
    stateStoreFailurePath: join(root, "state", "state-store-open-failure.json"),
    envPath: join(root, "config", "bridge.env"),
    servicePath: join(root, "service", "bridge.service"),
    launchAgentPath: join(root, "LaunchAgents", "bridge.plist"),
    binPath: join(root, "bin", "ctb"),
    manifestPath: join(root, "install", "install-manifest.json"),
    offsetPath: join(runtimeDir, "telegram-offset.json"),
    bridgeLogPath: join(logsDir, "bridge.log"),
    bootstrapLogPath: join(logsDir, "bootstrap.log"),
    appServerLogPath: join(logsDir, "app-server.log"),
    telegramStatusCardLogPath: join(logsDir, "status-card.log"),
    telegramPlanCardLogPath: join(logsDir, "plan-card.log"),
    telegramErrorCardLogPath: join(logsDir, "error-card.log")
  };
}

test("captureSystemdStopAudit scopes journal parsing to current invocation id", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-service-audit-test-"));
  const paths = createTestPaths(root);
  const calls: Array<{ command: string; args: string[] }> = [];

  try {
    await Promise.all([
      mkdir(paths.stateRoot, { recursive: true }),
      mkdir(paths.logsDir, { recursive: true })
    ]);

    const snapshot = await captureSystemdStopAudit(paths, {
      env: {
        SERVICE_RESULT: "success",
        EXIT_CODE: "exited",
        EXIT_STATUS: "0",
        INVOCATION_ID: "inv-123"
      } as NodeJS.ProcessEnv,
      runCommand: async (command: string, args: string[]): Promise<CommandResult> => {
        calls.push({ command, args });
        if (command === "systemctl") {
          return {
            exitCode: 0,
            stdout: [
              "Result=success",
              "ExecMainCode=1",
              "ExecMainStatus=0",
              "Restart=on-failure",
              "NRestarts=0",
              "InvocationID=inv-123"
            ].join("\n"),
            stderr: ""
          };
        }

        if (command === "journalctl") {
          return {
            exitCode: 0,
            stdout: "2026-03-22T08:24:57+08:00 Reloading requested from client PID 4181994 ('systemctl')\n",
            stderr: ""
          };
        }

        throw new Error(`unexpected command: ${command}`);
      }
    });

    const journalCall = calls.find((call) => call.command === "journalctl");
    assert.ok(journalCall);
    assert.equal(journalCall?.args.includes("_SYSTEMD_INVOCATION_ID=inv-123"), true);
    assert.equal(snapshot.invocationId, "inv-123");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("captureSystemdStopAudit keeps requester and oom unknown when invocation id is unavailable", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-service-audit-test-"));
  const paths = createTestPaths(root);

  try {
    await Promise.all([
      mkdir(paths.stateRoot, { recursive: true }),
      mkdir(paths.logsDir, { recursive: true })
    ]);

    const snapshot = await captureSystemdStopAudit(paths, {
      env: {
        SERVICE_RESULT: "success",
        EXIT_CODE: "exited",
        EXIT_STATUS: "0"
      } as NodeJS.ProcessEnv,
      runCommand: async (command: string): Promise<CommandResult> => {
        if (command === "systemctl") {
          return {
            exitCode: 0,
            stdout: [
              "Result=success",
              "ExecMainCode=1",
              "ExecMainStatus=0",
              "Restart=on-failure",
              "NRestarts=0",
              "InvocationID="
            ].join("\n"),
            stderr: ""
          };
        }

        if (command === "journalctl") {
          return {
            exitCode: 0,
            stdout: [
              "2026-03-22T07:00:00+08:00 Reloading requested from client PID 101 ('cron')",
              "2026-03-22T07:01:00+08:00 kernel: Out of memory: Killed process 42 (node)"
            ].join("\n"),
            stderr: ""
          };
        }

        throw new Error(`unexpected command: ${command}`);
      }
    });

    assert.equal(snapshot.invocationId, null);
    assert.equal(snapshot.requester, null);
    assert.equal(snapshot.possibleOom, false);
    assert.equal(snapshot.summary, "service stopped cleanly");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("captureSystemdStopAudit records collection errors when command exits non-zero", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-service-audit-test-"));
  const paths = createTestPaths(root);

  try {
    await Promise.all([
      mkdir(paths.stateRoot, { recursive: true }),
      mkdir(paths.logsDir, { recursive: true })
    ]);

    const snapshot = await captureSystemdStopAudit(paths, {
      env: {
        SERVICE_RESULT: "success",
        EXIT_CODE: "exited",
        EXIT_STATUS: "0",
        INVOCATION_ID: "inv-456"
      } as NodeJS.ProcessEnv,
      runCommand: async (command: string): Promise<CommandResult> => {
        if (command === "systemctl") {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "systemctl: access denied"
          };
        }

        if (command === "journalctl") {
          return {
            exitCode: 3,
            stdout: "",
            stderr: "journalctl: no entries"
          };
        }

        throw new Error(`unexpected command: ${command}`);
      }
    });

    assert.equal(
      snapshot.collectionErrors.some((line) => line.includes("systemctl show failed:")),
      true
    );
    assert.equal(
      snapshot.collectionErrors.some((line) => line.includes("journalctl failed:")),
      true
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
