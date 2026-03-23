import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { BridgePaths } from "./paths.js";
import { SYSTEMD_SERVICE_NAME } from "./platform.js";
import { runCommand, type CommandResult } from "./process.js";

export interface ServiceShutdownContext {
  recordedAt: string;
  source: string;
  signal: string | null;
  activeTurns: number;
  alreadyStopping: boolean;
}

export interface ServiceAuditSnapshot {
  recordedAt: string;
  source: "systemd_exec_stop_post";
  serviceManager: "systemd";
  unit: string;
  serviceResult: string;
  exitCode: string | null;
  exitStatus: string | null;
  systemdResult: string | null;
  systemdExecMainCode: string | null;
  systemdExecMainStatus: string | null;
  restart: string | null;
  nRestarts: number | null;
  invocationId: string | null;
  requester: string | null;
  stopSignal: string | null;
  possibleOom: boolean;
  summary: string;
  journalHighlights: string[];
  oomEvidence: string[];
  shutdownContext: ServiceShutdownContext | null;
  collectionErrors: string[];
}

interface CaptureSystemdStopAuditOptions {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  runCommand?: typeof runCommand;
}

interface AttemptedCommand {
  result: CommandResult | null;
  error: string | null;
}

const JOURNAL_HIGHLIGHT_PATTERN =
  /client PID|Stopping|Stopped|Failed|Main process exited|oom|out of memory|killed process|Consumed/iu;
const OOM_PATTERN = /oom|out of memory|killed process/iu;

function normalizeOptionalValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitNonEmptyLines(value: string): string[] {
  return value
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseKeyValueOutput(output: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of splitNonEmptyLines(output)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    values[key] = value;
  }

  return values;
}

function parseRequester(lines: string[]): string | null {
  for (const line of lines) {
    const match = line.match(/client PID (\d+) \('([^']+)'\)/u);
    if (match) {
      return `client_pid=${match[1]} comm=${match[2]}`;
    }
  }

  return null;
}

function formatRequesterSummary(requester: string | null): string | null {
  if (!requester) {
    return null;
  }

  const match = requester.match(/client_pid=(\d+) comm=(.+)/u);
  if (!match) {
    return requester;
  }

  return `client PID ${match[1]} (${match[2]})`;
}

function summarizeServiceAudit(snapshot: {
  serviceResult: string;
  requester: string | null;
  stopSignal: string | null;
  possibleOom: boolean;
}): string {
  if (snapshot.possibleOom) {
    return snapshot.serviceResult === "oom-kill"
      ? "service was terminated by oom-kill"
      : "service may have been terminated by an out-of-memory condition";
  }

  const requesterSummary = formatRequesterSummary(snapshot.requester);
  if (requesterSummary) {
    return `systemd stop requested by ${requesterSummary}`;
  }

  if (snapshot.stopSignal) {
    return `service stopped after ${snapshot.stopSignal}`;
  }

  if (snapshot.serviceResult === "success") {
    return "service stopped cleanly";
  }

  return `service ended with result ${snapshot.serviceResult}`;
}

async function attemptCommand(
  command: string,
  args: string[],
  run: typeof runCommand
): Promise<AttemptedCommand> {
  try {
    const result = await run(command, args);
    if (result.exitCode !== 0) {
      const detail = result.stderr || result.stdout || "no output";
      return {
        result,
        error: `${command} exited with code ${result.exitCode}: ${detail}`
      };
    }

    return {
      result,
      error: null
    };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function latestAuditPath(paths: BridgePaths): string {
  return join(paths.stateRoot, "service-audit-latest.json");
}

function auditLogPath(paths: BridgePaths): string {
  return join(paths.logsDir, "service-audit.log");
}

function shutdownContextPath(paths: BridgePaths): string {
  return join(paths.stateRoot, "service-shutdown-context.json");
}

async function readShutdownContext(paths: BridgePaths): Promise<ServiceShutdownContext | null> {
  try {
    const raw = await readFile(shutdownContextPath(paths), "utf8");
    return JSON.parse(raw) as ServiceShutdownContext;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    return null;
  }
}

export async function recordServiceShutdownContext(
  paths: BridgePaths,
  context: Omit<ServiceShutdownContext, "recordedAt"> & { recordedAt?: string }
): Promise<void> {
  const payload: ServiceShutdownContext = {
    recordedAt: context.recordedAt ?? new Date().toISOString(),
    source: context.source,
    signal: context.signal ?? null,
    activeTurns: context.activeTurns,
    alreadyStopping: context.alreadyStopping
  };

  const filePath = shutdownContextPath(paths);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function readLatestServiceAudit(paths: BridgePaths): Promise<ServiceAuditSnapshot | null> {
  try {
    const raw = await readFile(latestAuditPath(paths), "utf8");
    return JSON.parse(raw) as ServiceAuditSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    return null;
  }
}

export function formatServiceAuditLines(snapshot: ServiceAuditSnapshot | null): string[] {
  if (!snapshot) {
    return ["service_audit_present=false"];
  }

  const journalHighlights = snapshot.journalHighlights ?? [];
  const oomEvidence = snapshot.oomEvidence ?? [];
  const collectionErrors = snapshot.collectionErrors ?? [];
  const lines = [
    "service_audit_present=true",
    `service_audit_recorded_at=${snapshot.recordedAt}`,
    `service_audit_result=${snapshot.serviceResult}`,
    `service_audit_exit_code=${snapshot.exitCode ?? "unknown"}`,
    `service_audit_exit_status=${snapshot.exitStatus ?? "unknown"}`,
    `service_audit_requester=${snapshot.requester ?? "unknown"}`,
    `service_audit_stop_signal=${snapshot.stopSignal ?? "unknown"}`,
    `service_audit_possible_oom=${snapshot.possibleOom}`,
    `service_audit_summary=${snapshot.summary}`
  ];

  if (journalHighlights.length > 0) {
    lines.push(`service_audit_highlights=${journalHighlights.join(" || ")}`);
  }

  if (oomEvidence.length > 0) {
    lines.push(`service_audit_oom_evidence=${oomEvidence.join(" || ")}`);
  }

  if (collectionErrors.length > 0) {
    lines.push(`service_audit_collection_errors=${collectionErrors.join(" || ")}`);
  }

  return lines;
}

export async function captureSystemdStopAudit(
  paths: BridgePaths,
  options: CaptureSystemdStopAuditOptions = {}
): Promise<ServiceAuditSnapshot> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const run = options.runCommand ?? runCommand;
  const shutdownContext = await readShutdownContext(paths);

  const showAttempt = await attemptCommand("systemctl", [
    "--user",
    "show",
    SYSTEMD_SERVICE_NAME,
    "-p",
    "Result",
    "-p",
    "ExecMainCode",
    "-p",
    "ExecMainStatus",
    "-p",
    "Restart",
    "-p",
    "NRestarts",
    "-p",
    "InvocationID",
    "-p",
    "StatusErrno"
  ], run);
  const showValues = parseKeyValueOutput(showAttempt.result?.stdout ?? "");
  const invocationId = normalizeOptionalValue(env.INVOCATION_ID) ?? normalizeOptionalValue(showValues.InvocationID);
  const journalAttempt = invocationId
    ? await attemptCommand("journalctl", [
      "--user",
      "-u",
      SYSTEMD_SERVICE_NAME,
      "_SYSTEMD_INVOCATION_ID=" + invocationId,
      "-n",
      "60",
      "--no-pager",
      "--output=short-iso"
    ], run)
    : {
      result: null,
      error: "journal attribution skipped: invocation id unavailable"
    };
  const journalLines = splitNonEmptyLines(journalAttempt.result?.stdout ?? "");
  const journalHighlights = journalLines.filter((line) => JOURNAL_HIGHLIGHT_PATTERN.test(line)).slice(-8);
  const oomEvidence = journalLines.filter((line) => OOM_PATTERN.test(line)).slice(-5);
  const requester = parseRequester(journalHighlights.length > 0 ? journalHighlights : journalLines);
  const serviceResult = normalizeOptionalValue(env.SERVICE_RESULT) ?? normalizeOptionalValue(showValues.Result) ?? "unknown";
  const exitCode = normalizeOptionalValue(env.EXIT_CODE);
  const exitStatus = normalizeOptionalValue(env.EXIT_STATUS);
  const stopSignal = shutdownContext?.signal
    ?? ((exitCode === "killed" || exitCode === "dumped") ? exitStatus : null);
  const possibleOom = serviceResult === "oom-kill" || (invocationId !== null && oomEvidence.length > 0);
  const normalizedRestarts = normalizeOptionalValue(showValues.NRestarts);
  const snapshot: ServiceAuditSnapshot = {
    recordedAt: now.toISOString(),
    source: "systemd_exec_stop_post",
    serviceManager: "systemd",
    unit: SYSTEMD_SERVICE_NAME,
    serviceResult,
    exitCode,
    exitStatus,
    systemdResult: normalizeOptionalValue(showValues.Result),
    systemdExecMainCode: normalizeOptionalValue(showValues.ExecMainCode),
    systemdExecMainStatus: normalizeOptionalValue(showValues.ExecMainStatus),
    restart: normalizeOptionalValue(showValues.Restart),
    nRestarts: normalizedRestarts === null
      ? null
      : Number.parseInt(normalizedRestarts, 10),
    invocationId,
    requester,
    stopSignal,
    possibleOom,
    summary: summarizeServiceAudit({
      serviceResult,
      requester,
      stopSignal,
      possibleOom
    }),
    journalHighlights,
    oomEvidence,
    shutdownContext,
    collectionErrors: [
      showAttempt.error ? `systemctl show failed: ${showAttempt.error}` : null,
      journalAttempt.error ? `journalctl failed: ${journalAttempt.error}` : null
    ].filter((value): value is string => value !== null)
  };

  const latestPath = latestAuditPath(paths);
  const logPath = auditLogPath(paths);
  await mkdir(dirname(latestPath), { recursive: true });
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(latestPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await appendFile(logPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  await rm(shutdownContextPath(paths), { force: true });

  return snapshot;
}
