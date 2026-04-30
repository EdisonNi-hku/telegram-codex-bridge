import type { IncomingMessage, ServerResponse } from "node:http";

import type { WebReadonlyViewModelProvider } from "../service/web-readonly-view-model.js";
import {
  createConsoleBridgeReadAdapter,
  type ConsoleBridgeReadAdapter,
  type ConsoleSessionSummaryResult
} from "./console-bridge-read-adapter.js";
import {
  assertConsoleSafeString,
  isConsoleOpaqueId,
  type ConsoleApiError,
  type ConsoleOpaqueIdKind
} from "./console-api-contract.js";

export interface ConsoleApiHttpOptions {
  provider: WebReadonlyViewModelProvider;
  adapter?: ConsoleBridgeReadAdapter;
}

type JsonRouteResult = { status: number; body: unknown };

const JSON_SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff"
} as const;

const idFieldKinds = {
  projectId: "project",
  activeProjectId: "project",
  sessionId: "session",
  activeSessionId: "session",
  messageId: "message",
  runId: "run",
  activeRunId: "run",
  approvalId: "approval",
  artifactId: "artifact"
} as const satisfies Record<string, ConsoleOpaqueIdKind>;

const listIdFieldKinds = {
  approvalIds: "approval",
  artifactIds: "artifact",
  attachmentArtifactIds: "artifact"
} as const satisfies Record<string, ConsoleOpaqueIdKind>;

const rawBridgeStringPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "raw conversation identifier", pattern: /\bcv_[a-f0-9]{16}\b/i },
  { label: "raw workspace identifier", pattern: /\bwk_[A-Za-z0-9_-]{2,}\b/ },
  { label: "raw interaction identifier", pattern: /\bpi_[A-Za-z0-9_-]{2,}\b/i },
  { label: "raw answer identifier", pattern: /\banswer[-_][A-Za-z0-9_-]{2,}\b/i },
  { label: "platform marker", pattern: /(?:telegram|feishu|open_id|union_id|tenant|callback_data)/i },
  { label: "chat identifier", pattern: /\b(?:chatId|telegramChatId|feishuChatId|platformMessageId|messageId|threadId)\b/ },
  { label: "secret marker", pattern: /\b(?:token|authorization|bearer|api[_-]?key|secret|password)\s*[:=]/i },
  { label: "process marker", pattern: /\b(?:pid|processId|process[_-]?id)\s*[:=]?\s*\d{2,}\b/i },
  { label: "raw terminal marker", pattern: /\b(?:rawTerminal|stdout|stderr)\b/i }
];

const rawBridgeKeyPattern =
  /(?:telegram|feishu|open[_-]?id|union[_-]?id|tenant[_-]?key|callback[_-]?data|rawTerminal|stdout|stderr|token|secret|authorization|bearer|api[_-]?key|password|chatId|threadId|platformMessageId|conversationHandle|conversationId|workspaceId|answerId|interactionId|processId|pid)/;

export function isConsoleApiPath(urlValue: string): boolean {
  const pathname = safePathname(urlValue);
  return Boolean(pathname && isApiPathname(pathname));
}

export function sendConsoleApiDenied(response: ServerResponse, headOnly = false): void {
  sendJson(response, 404, notFoundError(), headOnly);
}

export function handleConsoleApiHttpRequest(
  options: ConsoleApiHttpOptions,
  request: IncomingMessage,
  response: ServerResponse
): boolean {
  const pathname = safePathname(request.url ?? "/");
  if (!pathname || !isApiPathname(pathname)) {
    return false;
  }

  const method = request.method ?? "GET";
  const headOnly = method === "HEAD";
  if (method !== "GET" && method !== "HEAD") {
    sendJson(response, 404, notFoundError(), false);
    return true;
  }

  sendRouteResult(response, resolveConsoleApiRoute(pathname, options), headOnly);
  return true;
}

function resolveConsoleApiRoute(pathname: string, options: ConsoleApiHttpOptions): JsonRouteResult {
  try {
    if (pathname === "/api/console/bootstrap") {
      return adapterPayload(() => adapterFor(options).getBootstrap());
    }

    if (pathname === "/api/projects") {
      return adapterPayload(() => adapterFor(options).listProjects());
    }

    const projectSessionsMatch = /^\/api\/projects\/([^/]+)\/sessions$/.exec(pathname);
    if (projectSessionsMatch?.[1]) {
      const projectId = projectSessionsMatch[1];
      if (!isSafeRouteOpaqueId("project", projectId)) {
        return safeError(400, badRequestError("Project id must be an opaque Console project id."));
      }
      return adapterPayload((): ConsoleSessionSummaryResult => adapterFor(options).listProjectSessions(projectId));
    }

    const sessionEventsMatch = /^\/api\/sessions\/([^/]+)\/events$/.exec(pathname);
    if (sessionEventsMatch?.[1]) {
      const sessionId = sessionEventsMatch[1];
      if (!isSafeRouteOpaqueId("session", sessionId)) {
        return safeError(400, badRequestError("Session id must be an opaque Console session id."));
      }
      return safeError(409, {
        code: "capability_disabled",
        message: "Session event streams are unavailable in this read-only HTTP harness.",
        retryable: false,
        capability: "streamEvents"
      });
    }

    const sessionDetailMatch = /^\/api\/sessions\/([^/]+)$/.exec(pathname);
    if (sessionDetailMatch?.[1]) {
      const sessionId = sessionDetailMatch[1];
      if (!isSafeRouteOpaqueId("session", sessionId)) {
        return safeError(400, badRequestError("Session id must be an opaque Console session id."));
      }
      return adapterPayload(() => adapterFor(options).getSessionDetail(sessionId));
    }

    return safeError(404, notFoundError());
  } catch {
    return safeError(500, internalError());
  }
}

function adapterFor(options: ConsoleApiHttpOptions): ConsoleBridgeReadAdapter {
  return options.adapter ?? createConsoleBridgeReadAdapter({ provider: options.provider });
}

function adapterPayload(read: () => unknown): JsonRouteResult {
  let payload: unknown;
  try {
    payload = read();
  } catch {
    return safeError(500, internalError());
  }

  if (isConsoleApiError(payload)) {
    return safeError(statusForConsoleApiError(payload), payload);
  }
  return safeBody(200, payload);
}

function sendRouteResult(response: ServerResponse, result: JsonRouteResult, headOnly: boolean): void {
  sendJson(response, result.status, result.body, headOnly);
}

function sendJson(response: ServerResponse, status: number, body: unknown, headOnly: boolean): void {
  const text = `${JSON.stringify(body)}\n`;
  response.writeHead(status, {
    ...JSON_SECURITY_HEADERS,
    "Content-Length": Buffer.byteLength(headOnly ? "" : text)
  });
  response.end(headOnly ? undefined : text);
}

function safeBody(status: number, body: unknown): JsonRouteResult {
  try {
    assertConsoleApiPayloadSafe(body);
    JSON.stringify(body);
    return { status, body };
  } catch {
    return { status: 500, body: internalError() };
  }
}

function safeError(status: number, error: ConsoleApiError): JsonRouteResult {
  return safeBody(status, error);
}

function badRequestError(message: string): ConsoleApiError {
  return { code: "bad_request", message, retryable: false };
}

function notFoundError(): ConsoleApiError {
  return { code: "not_found", message: "Not found.", retryable: false };
}

function internalError(): ConsoleApiError {
  return {
    code: "internal_error",
    message: "Console API response is temporarily unavailable.",
    retryable: true
  };
}

function statusForConsoleApiError(error: ConsoleApiError): number {
  switch (error.code) {
    case "bad_request":
      return 400;
    case "unauthorized":
    case "forbidden":
    case "not_found":
      return 404;
    case "capability_disabled":
    case "conflict":
      return 409;
    case "rate_limited":
      return 429;
    case "bridge_unavailable":
      return 503;
    case "internal_error":
      return 500;
  }
}

function isSafeRouteOpaqueId(kind: ConsoleOpaqueIdKind, value: string): boolean {
  if (!isConsoleOpaqueId(kind, value)) {
    return false;
  }
  try {
    assertNoRawBridgeMarkers(value, `${kind}Id`);
    return true;
  } catch {
    return false;
  }
}

function assertConsoleApiPayloadSafe(value: unknown): void {
  visitShape(value, (node, key) => {
    if (key && rawBridgeKeyPattern.test(key)) {
      throw new TypeError(`field name contains raw Bridge marker`);
    }

    if (typeof node === "string") {
      assertConsoleSafeString(node, key ?? "value");
      assertNoRawBridgeMarkers(node, key ?? "value");
    }

    if (!key) {
      return;
    }

    const kind = idFieldKinds[key as keyof typeof idFieldKinds];
    if (kind && !isConsoleOpaqueId(kind, node)) {
      throw new TypeError(`${key} must be an opaque Console ${kind} id`);
    }

    const listKind = listIdFieldKinds[key as keyof typeof listIdFieldKinds];
    if (listKind) {
      if (!Array.isArray(node)) {
        throw new TypeError(`${key} must be a list of opaque Console ${listKind} ids`);
      }
      for (const item of node) {
        if (!isConsoleOpaqueId(listKind, item)) {
          throw new TypeError(`${key} must contain only opaque Console ${listKind} ids`);
        }
      }
    }

    if (key === "eventsUrl" && typeof node === "string" && !/^\/api\/sessions\/ses_[A-Za-z0-9_-]{6,128}\/events$/.test(node)) {
      throw new TypeError("eventsUrl must use an opaque Console session id");
    }

    if (key === "url" && typeof node === "string" && node.startsWith("/api/artifacts/") && !/^\/api\/artifacts\/art_[A-Za-z0-9_-]{6,128}$/.test(node)) {
      throw new TypeError("artifact url must use an opaque Console artifact id");
    }
  });
}

function assertNoRawBridgeMarkers(value: string, fieldName: string): void {
  for (const { label, pattern } of rawBridgeStringPatterns) {
    if (pattern.test(value)) {
      throw new TypeError(`${fieldName} contains ${label}`);
    }
  }
}

function visitShape(value: unknown, visitor: (node: unknown, key?: string) => void, key?: string): void {
  visitor(value, key);
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      visitShape(item, visitor);
    }
    return;
  }
  for (const [childKey, childValue] of Object.entries(value)) {
    visitShape(childValue, visitor, childKey);
  }
}

function isConsoleApiError(value: unknown): value is ConsoleApiError {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as ConsoleApiError).code === "string" &&
    typeof (value as ConsoleApiError).message === "string" &&
    typeof (value as ConsoleApiError).retryable === "boolean"
  );
}

function safePathname(urlValue: string): string | null {
  try {
    return new URL(urlValue, "http://127.0.0.1").pathname;
  } catch {
    return null;
  }
}

function isApiPathname(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
