import type { CodexAppServerClient } from "../codex/app-server.js";
import {
  extractTerminalArtifactsFromTurnItems,
  turnItemsContainCompactionTruth,
  type TerminalMessageSource
} from "../codex/protocol-truth.js";

type HistoryTurn = Awaited<ReturnType<CodexAppServerClient["resumeThread"]>>["thread"]["turns"][number];
type FinalMessageSource = TerminalMessageSource;

export interface TurnArtifactsFromHistory {
  finalMessage: string | null;
  finalMessageSource: FinalMessageSource;
  proposedPlan: string | null;
  compactionDetected: boolean;
  requestedTurnFound: boolean;
  usedReviewFallback: boolean;
  reviewArtifactsPresent: boolean;
  resolvedTurnId: string | null;
}
export async function extractFinalAnswerFromHistory(
  appServer: CodexAppServerClient,
  threadId: string,
  turnId: string
): Promise<string | null> {
  const artifacts = await extractTurnArtifactsFromHistory(appServer, threadId, turnId);
  return artifacts.finalMessage ?? artifacts.proposedPlan;
}

export async function extractTurnArtifactsFromHistory(
  appServer: CodexAppServerClient,
  threadId: string,
  turnId: string,
  options?: {
    allowReviewFallback?: boolean;
    knownReviewTurnIdsAtStart?: readonly string[] | null;
    preferredTurnId?: string | null;
  }
): Promise<TurnArtifactsFromHistory> {
  const resumed = await appServer.resumeThread(threadId);
  const knownReviewTurnIdsAtStart = new Set(options?.knownReviewTurnIdsAtStart ?? []);
  const targetTurn = resumed.thread.turns.find((turn) => turn.id === turnId) ?? null;
  const preferredTurnCandidate = options?.preferredTurnId
    ? resumed.thread.turns.find((turn) => turn.id === options.preferredTurnId) ?? null
    : null;
  const preferredTurn = preferredTurnCandidate && !knownReviewTurnIdsAtStart.has(preferredTurnCandidate.id)
    ? preferredTurnCandidate
    : null;
  const requestedTurnFound = targetTurn !== null;
  const fallbackTurn = !requestedTurnFound && options?.allowReviewFallback
    ? findMostRecentCompletedReviewTurn(
      resumed.thread.turns,
      knownReviewTurnIdsAtStart
    )
    : null;
  const resolvedTurn = preferredTurn ?? targetTurn ?? fallbackTurn;
  const reviewArtifactsPresent = resolvedTurn !== null && turnContainsReviewArtifacts(resolvedTurn);
  const extracted = resolvedTurn
    ? extractArtifactsFromTurn(resolvedTurn, {
      allowTrailingAgentMessage: reviewArtifactsPresent
    })
    : null;

  if (!resolvedTurn) {
    return {
      finalMessage: null,
      finalMessageSource: null,
      proposedPlan: null,
      compactionDetected: false,
      requestedTurnFound,
      usedReviewFallback: false,
      reviewArtifactsPresent,
      resolvedTurnId: null
    };
  }

  return {
    finalMessage: extracted?.finalMessage ?? null,
    finalMessageSource: extracted?.finalMessageSource ?? null,
    proposedPlan: extracted?.proposedPlan ?? null,
    compactionDetected: extracted?.compactionDetected ?? false,
    requestedTurnFound,
    usedReviewFallback: fallbackTurn !== null || (preferredTurn !== null && preferredTurn.id !== turnId),
    reviewArtifactsPresent,
    resolvedTurnId: resolvedTurn.id
  };
}

function extractArtifactsFromTurn(
  targetTurn: HistoryTurn,
  options?: {
    allowTrailingAgentMessage?: boolean;
  }
): {
  finalMessage: string | null;
  finalMessageSource: FinalMessageSource;
  proposedPlan: string | null;
  compactionDetected: boolean;
} {
  const extracted = extractTerminalArtifactsFromTurnItems(targetTurn.items, options);
  return {
    finalMessage: extracted.terminalMessage,
    finalMessageSource: extracted.terminalMessageSource,
    proposedPlan: extracted.proposedPlan,
    compactionDetected: turnItemsContainCompactionTruth(targetTurn.items)
  };
}
function turnContainsReviewArtifacts(turn: HistoryTurn): boolean {
  return turn.items.some((item) => item.type === "exitedReviewMode");
}

function findMostRecentCompletedReviewTurn(
  turns: HistoryTurn[],
  knownReviewTurnIdsAtStart: ReadonlySet<string>
): HistoryTurn | null {
  return [...turns].reverse().find((turn) => {
    if ((turn.status ?? "completed") !== "completed" || !turnContainsReviewArtifacts(turn)) {
      return false;
    }

    return !knownReviewTurnIdsAtStart.has(turn.id);
  }) ?? null;
}
