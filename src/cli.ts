#!/usr/bin/env node

import { getBridgePaths } from "./paths.js";
import { createLogger } from "./logger.js";
import { loadConfig, parseProjectScanRootsValue, type BridgeInstallOverrides } from "./config.js";
import { buildPerformanceReport, parseReportWindowMs } from "./perf/report.js";
import { parseBridgePackName } from "./packs/catalog.js";
import { parseBooleanLike } from "./util/boolean.js";
import { startWebReadonlyLocalHarness } from "./web/readonly-cli.js";
import {
  captureSystemdStopAuditCommand,
  clearAuthorization,
  getStatus,
  installBridge,
  installCodexSkill,
  listPendingAuthorizations,
  restartService,
  runDoctor,
  startService,
  stopService,
  uninstallBridge,
  updateBridge
} from "./install.js";
import { runBridgeRuntime } from "./runtime.js";

interface ParsedFlags {
  [key: string]: string | boolean | undefined;
}

function parseFlags(args: string[]): ParsedFlags {
  const flags: ParsedFlags = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function parseBooleanFlag(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  return parseBooleanLike(value);
}

function parseRepeatedFlag(args: string[], flagName: string): string[] {
  const matches: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== `--${flagName}`) {
      continue;
    }

    const next = args[index + 1];
    if (typeof next === "string" && !next.startsWith("--")) {
      matches.push(next);
      index += 1;
    }
  }

  return matches;
}

function parsePackOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (const entry of parseRepeatedFlag(args, "pack-option")) {
    const separator = entry.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    options[entry.slice(0, separator)] = entry.slice(separator + 1);
  }

  return options;
}

function printUsage(): void {
  process.stdout.write(`Usage:
  ctb install [--pack <name>] [--pack-option key=value] [--telegram-token <token>] [--codex-bin <bin>] [--project-scan-roots <path1:path2:...>] [--voice-input <true|false>] [--voice-openai-api-key <key>] [--voice-openai-model <model>] [--voice-ffmpeg-bin <bin>] [--perf-monitor-enabled <true|false>] [--perf-monitor-sample-interval-ms <ms>] [--perf-monitor-retention-days <days>] [--app-server-guard-enabled <true|false>] [--app-server-guard-sample-interval-ms <ms>] [--app-server-guard-mcp-worker-threshold <n>] [--app-server-guard-consecutive-windows <n>] [--app-server-guard-cooldown-ms <ms>]
  ctb install-skill [--pack <name>]
  ctb status
  ctb doctor
  ctb perf report [--window <5m|1h|24h|7d>]
  ctb web readonly [--token <token>] [--port <port>]
  ctb start | stop | restart | update
  ctb uninstall [--purge-state]
  ctb authorize pending [--latest | --select <index> | --user-id <id> | --show-expired]
  ctb authorize clear
  ctb audit capture-systemd-stop
  ctb service run
`);
}

async function main(): Promise<void> {
  const paths = getBridgePaths(import.meta.url);
  const logger = createLogger("cli", paths.bootstrapLogPath);

  const [, , command, ...argv] = process.argv;
  const subcommand = argv[0];
  const flagArgs = subcommand?.startsWith("--") ? argv : argv.slice(1);
  const flags = parseFlags(flagArgs);
  const packOptions = parsePackOptions(flagArgs);

  switch (command) {
    case "install": {
      const installOverrides: BridgeInstallOverrides = {};

      if (typeof flags.pack === "string") {
        const packName = parseBridgePackName(flags.pack);
        if (!packName) {
          process.stderr.write("invalid --pack value\n");
          process.exitCode = 1;
          return;
        }
        installOverrides.activePack = packName;
      }

      if (Object.keys(packOptions).length > 0) {
        installOverrides.packOptions = {
          ...packOptions
        };
      }

      if (typeof flags["telegram-token"] === "string") {
        installOverrides.packOptions = {
          ...(installOverrides.packOptions ?? {}),
          "bot-token": flags["telegram-token"]
        };
      }

      if (typeof flags["codex-bin"] === "string") {
        installOverrides.codexBin = flags["codex-bin"];
      }

      if (typeof flags["project-scan-roots"] === "string") {
        installOverrides.projectScanRoots = parseProjectScanRootsValue(
          flags["project-scan-roots"],
          paths.homeDir
        );
      }

      const voiceInputEnabled = parseBooleanFlag(flags["voice-input"]);
      if (voiceInputEnabled !== undefined) {
        installOverrides.voiceInputEnabled = voiceInputEnabled;
      }
      if (typeof flags["voice-openai-api-key"] === "string") {
        installOverrides.voiceOpenaiApiKey = flags["voice-openai-api-key"];
      }
      if (typeof flags["voice-openai-model"] === "string") {
        installOverrides.voiceOpenaiTranscribeModel = flags["voice-openai-model"];
      }
      if (typeof flags["voice-ffmpeg-bin"] === "string") {
        installOverrides.voiceFfmpegBin = flags["voice-ffmpeg-bin"];
      }
      const perfMonitorEnabled = parseBooleanFlag(flags["perf-monitor-enabled"]);
      if (perfMonitorEnabled !== undefined) {
        installOverrides.perfMonitorEnabled = perfMonitorEnabled;
      }
      if (typeof flags["perf-monitor-sample-interval-ms"] === "string") {
        installOverrides.perfMonitorSampleIntervalMs = Number.parseInt(flags["perf-monitor-sample-interval-ms"], 10);
      }
      if (typeof flags["perf-monitor-retention-days"] === "string") {
        installOverrides.perfMonitorRetentionDays = Number.parseInt(flags["perf-monitor-retention-days"], 10);
      }
      const appServerGuardEnabled = parseBooleanFlag(flags["app-server-guard-enabled"]);
      if (appServerGuardEnabled !== undefined) {
        installOverrides.appServerGuardEnabled = appServerGuardEnabled;
      }
      if (typeof flags["app-server-guard-sample-interval-ms"] === "string") {
        installOverrides.appServerGuardSampleIntervalMs = Number.parseInt(flags["app-server-guard-sample-interval-ms"], 10);
      }
      if (typeof flags["app-server-guard-mcp-worker-threshold"] === "string") {
        installOverrides.appServerGuardMcpWorkerThreshold = Number.parseInt(flags["app-server-guard-mcp-worker-threshold"], 10);
      }
      if (typeof flags["app-server-guard-consecutive-windows"] === "string") {
        installOverrides.appServerGuardConsecutiveWindows = Number.parseInt(flags["app-server-guard-consecutive-windows"], 10);
      }
      if (typeof flags["app-server-guard-cooldown-ms"] === "string") {
        installOverrides.appServerGuardCooldownMs = Number.parseInt(flags["app-server-guard-cooldown-ms"], 10);
      }

      await installBridge(paths, logger, {
        ...installOverrides
      });
      process.stdout.write("install complete\n");
      process.stdout.write(`${await getStatus(paths)}\n`);
      return;
    }

    case "status": {
      process.stdout.write(`${await getStatus(paths)}\n`);
      return;
    }

    case "install-skill": {
      const requestedPack = typeof flags.pack === "string" ? parseBridgePackName(flags.pack) : null;
      if (typeof flags.pack === "string" && !requestedPack) {
        process.stderr.write("invalid --pack value\n");
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${await installCodexSkill(paths, requestedPack ?? undefined)}\n`);
      return;
    }

    case "doctor": {
      process.stdout.write(`${await runDoctor(paths, logger)}\n`);
      return;
    }

    case "perf": {
      if (subcommand !== "report") {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const config = await loadConfig(paths);
      const windowMs = typeof flags.window === "string"
        ? parseReportWindowMs(flags.window)
        : 60 * 60 * 1000;

      if (windowMs === null) {
        process.stderr.write("invalid --window value; expected 5m, 1h, 24h, or 7d\n");
        process.exitCode = 1;
        return;
      }

      process.stdout.write(`${await buildPerformanceReport({
        paths,
        config,
        windowMs
      })}\n`);
      return;
    }

    case "web": {
      if (subcommand !== "readonly") {
        printUsage();
        process.exitCode = 1;
        return;
      }

      if (flags.host !== undefined) {
        process.stderr.write("ctb web readonly is local-only; --host is not supported\n");
        process.exitCode = 1;
        return;
      }

      await startWebReadonlyLocalHarness({
        paths,
        logger,
        token: flags.token,
        port: flags.port,
        env: process.env
      });
      return;
    }

    case "start": {
      await startService(paths);
      process.stdout.write("service started\n");
      return;
    }

    case "stop": {
      await stopService(paths);
      process.stdout.write("service stopped\n");
      return;
    }

    case "restart": {
      await restartService(paths);
      process.stdout.write("service restarted\n");
      return;
    }

    case "update": {
      await updateBridge(paths);
      process.stdout.write("update complete\n");
      return;
    }

    case "uninstall": {
      await uninstallBridge(paths, Boolean(flags["purge-state"]));
      process.stdout.write("uninstall complete\n");
      return;
    }

    case "authorize": {
      if (subcommand === "pending") {
        const options: {
          includeExpired?: boolean;
          latest?: boolean;
          select?: number;
          userId?: string;
        } = {};

        if (flags["show-expired"] === true) {
          options.includeExpired = true;
        }

        if (flags.latest === true) {
          options.latest = true;
        }

        if (typeof flags.select === "string") {
          options.select = Number.parseInt(flags.select, 10);
        }

        if (typeof flags["user-id"] === "string") {
          options.userId = flags["user-id"];
        }

        process.stdout.write(
          `${await listPendingAuthorizations(paths, logger, options)}\n`
        );
        return;
      }

      if (subcommand === "clear") {
        process.stdout.write(`${await clearAuthorization(paths, logger)}\n`);
        return;
      }

      printUsage();
      process.exitCode = 1;
      return;
    }

    case "audit": {
      if (subcommand !== "capture-systemd-stop") {
        printUsage();
        process.exitCode = 1;
        return;
      }

      await captureSystemdStopAuditCommand(paths);
      return;
    }

    case "service": {
      if (subcommand !== "run") {
        printUsage();
        process.exitCode = 1;
        return;
      }

      await runBridgeRuntime(import.meta.url);
      return;
    }

    default: {
      printUsage();
      process.exitCode = 1;
    }
  }
}

await main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
