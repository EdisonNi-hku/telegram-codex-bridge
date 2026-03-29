import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

test("cli perf report renders the recent perf summary", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "ctb-cli-test-home-"));
  const repoRoot = process.cwd();
  const configRoot = join(homeDir, ".config", "codex-telegram-bridge");
  const perfLogsDir = join(homeDir, ".local", "state", "codex-telegram-bridge", "logs", "perf");
  const now = new Date();

  try {
    await mkdir(configRoot, { recursive: true });
    await mkdir(perfLogsDir, { recursive: true });
    await writeFile(
      join(configRoot, "bridge.env"),
      [
        "TELEGRAM_BOT_TOKEN=test-token",
        "PERF_MONITOR_ENABLED=1",
        "PERF_MONITOR_SAMPLE_INTERVAL_MS=15000",
        "PERF_MONITOR_RETENTION_DAYS=7"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(perfLogsDir, `${now.toISOString().slice(0, 10)}.jsonl`),
      `${JSON.stringify({
        ts: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        kind: "operation",
        category: "app_server_rpc",
        name: "turn/start",
        durationMs: 120,
        outcome: "ok",
        pid: 123
      })}\n`,
      "utf8"
    );

    const result = await execFile(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", "perf", "report", "--window", "1h"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          HOME: homeDir
        }
      }
    );

    assert.match(result.stdout, /^perf_monitor_enabled=true$/mu);
    if (process.platform === "linux") {
      assert.match(result.stdout, /^app_server_rpc_count=1$/mu);
    } else {
      assert.match(result.stdout, /^perf_monitor_supported=false$/mu);
    }
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test("cli usage includes app-server guard install flags", async () => {
  const repoRoot = process.cwd();

  try {
    await execFile(
      process.execPath,
      ["--import", "tsx", "src/cli.ts"],
      { cwd: repoRoot }
    );
    assert.fail("cli should exit with usage when command is missing");
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? "";
    assert.match(stdout, /--app-server-guard-enabled/u);
    assert.match(stdout, /--app-server-guard-sample-interval-ms/u);
    assert.match(stdout, /--app-server-guard-mcp-worker-threshold/u);
    assert.match(stdout, /--app-server-guard-consecutive-windows/u);
    assert.match(stdout, /--app-server-guard-cooldown-ms/u);
  }
});
