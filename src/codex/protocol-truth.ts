import type { JsonRpcRequestId } from "./app-server.js";
import { hasMeaningfulText } from "../util/text.js";

export type AgentMessagePhase = "commentary" | "final_answer";
export type ServerRequestIdKind = "number" | "string";

export type TerminalMessageSource = "final_answer" | "review_exit" | "agent_message" | null;

export interface ProtocolTurnItem {
  type: string;
  text?: string | null;
  phase?: string | null;
  review?: string | null;
}

export interface ExtractedTerminalArtifacts {
  terminalMessage: string | null;
  terminalMessageSource: TerminalMessageSource;
  proposedPlan: string | null;
}

export interface StoredServerRequestId {
  value: JsonRpcRequestId;
  canonical: string;
  legacy: string | null;
  kind: ServerRequestIdKind;
}

const COMPACTION_ITEM_TYPES = new Set([
  "compaction",
  "contextCompaction"
]);

export function parseAgentMessagePhase(value: unknown): AgentMessagePhase | null {
  return value === "commentary" || value === "final_answer" ? value : null;
}

export function isCommentaryAgentMessagePhase(value: unknown): boolean {
  return parseAgentMessagePhase(value) === "commentary";
}

export function serializeServerRequestId(id: JsonRpcRequestId): string {
  return JSON.stringify(id);
}

export function deserializeServerRequestId(text: string): JsonRpcRequestId {
  try {
    const parsed = JSON.parse(text) as JsonRpcRequestId;
    if (typeof parsed === "number" || typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // Fall through to legacy plain-text compatibility.
  }

  return text;
}

export function createStoredServerRequestId(requestId: JsonRpcRequestId): StoredServerRequestId {
  return {
    value: requestId,
    canonical: serializeServerRequestId(requestId),
    legacy: typeof requestId === "string" ? requestId : null,
    kind: typeof requestId === "number" ? "number" : "string"
  };
}

export function readStoredServerRequestId(options: {
  requestIdText: string;
  requestIdCanonical?: string | null;
  requestIdLegacy?: string | null;
  requestIdKind?: string | null;
}): StoredServerRequestId {
  const kind = options.requestIdKind === "number" ? "number" : options.requestIdKind === "string" ? "string" : null;
  const canonical = options.requestIdCanonical ?? null;
  const legacy = options.requestIdLegacy ?? null;

  if (canonical && kind) {
    const value = deserializeServerRequestId(canonical);
    return {
      value,
      canonical,
      legacy: kind === "string" ? (legacy ?? `${value}`) : null,
      kind
    };
  }

  if (legacy !== null) {
    return createStoredServerRequestId(legacy);
  }

  const parsed = tryParseCanonicalRequestId(options.requestIdText);
  if (parsed) {
    return createStoredServerRequestId(parsed);
  }

  return createStoredServerRequestId(options.requestIdText);
}

export function getCompatibleSerializedRequestIds(requestId: JsonRpcRequestId): string[] {
  const stored = createStoredServerRequestId(requestId);
  return stored.legacy ? [stored.canonical, stored.legacy] : [stored.canonical];
}

export function isCompactionItemType(value: unknown): boolean {
  return typeof value === "string" && COMPACTION_ITEM_TYPES.has(value);
}

export function turnItemsContainCompactionTruth(items: ProtocolTurnItem[]): boolean {
  return items.some((item) => isCompactionItemType(item.type));
}

function tryParseCanonicalRequestId(text: string): JsonRpcRequestId | null {
  try {
    const parsed = JSON.parse(text) as JsonRpcRequestId;
    if ((typeof parsed === "number" || typeof parsed === "string") && serializeServerRequestId(parsed) === text) {
      return parsed;
    }
  } catch {
    // Fall through to legacy plain-text handling.
  }

  return null;
}

export function extractTerminalArtifactsFromTurnItems(
  items: ProtocolTurnItem[],
  options?: {
    allowTrailingAgentMessage?: boolean;
  }
): ExtractedTerminalArtifacts {
  const finalItem = items.find(
    (item) => item.type === "agentMessage"
      && parseAgentMessagePhase(item.phase) === "final_answer"
      && hasMeaningfulText(item.text)
  );
  const reviewExitItem = [...items].reverse().find(
    (item) => item.type === "exitedReviewMode" && hasMeaningfulText(item.review)
  );
  const trailingAgentMessage = options?.allowTrailingAgentMessage
    ? [...items].reverse().find(
      (item) => item.type === "agentMessage"
        && !isCommentaryAgentMessagePhase(item.phase)
        && hasMeaningfulText(item.text)
    )
    : null;
  const planItem = [...items].reverse().find(
    (item) => item.type === "plan" && typeof item.text === "string"
  );

  if (finalItem) {
    return {
      terminalMessage: finalItem.text ?? null,
      terminalMessageSource: "final_answer",
      proposedPlan: planItem?.text ?? null
    };
  }

  if (trailingAgentMessage) {
    return {
      terminalMessage: trailingAgentMessage.text ?? null,
      terminalMessageSource: "agent_message",
      proposedPlan: planItem?.text ?? null
    };
  }

  if (reviewExitItem) {
    return {
      terminalMessage: reviewExitItem.review ?? null,
      terminalMessageSource: "review_exit",
      proposedPlan: planItem?.text ?? null
    };
  }

  return {
    terminalMessage: null,
    terminalMessageSource: null,
    proposedPlan: planItem?.text ?? null
  };
}
