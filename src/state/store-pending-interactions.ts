import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { JsonRpcRequestId } from "../codex/app-server.js";
import {
  createStoredServerRequestId,
  readStoredServerRequestId
} from "../codex/protocol-truth.js";
import { resolvePlatformChatRef } from "../core/domain/binding.js";
import type {
  PendingInteractionKind,
  PendingInteractionRow,
  PendingInteractionState
} from "../types.js";
import { nowIso } from "../util/time.js";
import { buildInClausePlaceholders } from "./store-shared.js";

interface PendingInteractionRecord {
  interaction_id: string;
  chat_id: string;
  session_id: string;
  thread_id: string;
  turn_id: string;
  request_id: string;
  request_id_canonical: string | null;
  request_id_legacy: string | null;
  request_id_kind: "number" | "string" | null;
  request_method: string;
  interaction_kind: PendingInteractionKind;
  state: PendingInteractionState;
  prompt_json: string;
  response_json: string | null;
  message_id: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  error_reason: string | null;
}

function mapPendingInteraction(record: PendingInteractionRecord): PendingInteractionRow {
  const requestId = readStoredServerRequestId({
    requestIdText: record.request_id,
    requestIdCanonical: record.request_id_canonical,
    requestIdLegacy: record.request_id_legacy,
    requestIdKind: record.request_id_kind
  });
  return {
    interactionId: record.interaction_id,
    chatId: record.chat_id,
    sessionId: record.session_id,
    threadId: record.thread_id,
    turnId: record.turn_id,
    requestId: requestId.value,
    requestMethod: record.request_method,
    interactionKind: record.interaction_kind,
    state: record.state,
    promptJson: record.prompt_json,
    responseJson: record.response_json,
    messageId: record.message_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    resolvedAt: record.resolved_at,
    errorReason: record.error_reason
  };
}

function resolveChatId(options: { chatId: string }): string {
  return resolvePlatformChatRef(options).chatId;
}

function resolveMessageId(options: {
  messageId?: number | null | undefined;
}): number | null {
  return options.messageId ?? null;
}

export interface StorePendingInteractions {
  createPendingInteraction(options: {
    interactionId?: string;
    chatId: string;
    sessionId: string;
    threadId: string;
    turnId: string;
    requestId: JsonRpcRequestId;
    requestMethod: string;
    interactionKind: PendingInteractionKind;
    state?: PendingInteractionState;
    promptJson: string;
    responseJson?: string | null;
    messageId?: number | null;
    errorReason?: string | null;
  }): PendingInteractionRow;
  getPendingInteraction(interactionId: string, chatId?: string): PendingInteractionRow | null;
  listPendingInteractionsByRequest(threadId: string, requestId: JsonRpcRequestId): PendingInteractionRow[];
  listPendingInteractionsByChat(
    chatId: string,
    states?: PendingInteractionState[]
  ): PendingInteractionRow[];
  listActionableUnsurfacedPendingInteractionsForSession(
    chatId: string,
    sessionId: string
  ): PendingInteractionRow[];
  listPendingInteractionsByTurn(threadId: string, turnId: string): PendingInteractionRow[];
  listUnresolvedPendingInteractions(): PendingInteractionRow[];
  listPendingInteractionsForRunningSessions(): PendingInteractionRow[];
  clearPendingInteractionsByChat(chatId: string): void;
  rebindPendingInteractionsChatIds(chatId: string, previousChatIds: string[]): void;
  clearAllPendingInteractions(): void;
  failPendingInteractionsForSessionIds(sessionIds: string[], timestamp: string, reason: string): void;
  setPendingInteractionMessageId(interactionId: string, messageId: number): void;
  savePendingInteractionDraftResponse(
    interactionId: string,
    state: PendingInteractionState,
    responseJson: string | null
  ): void;
  markPendingInteractionAwaitingText(interactionId: string, responseJson?: string | null): void;
  markPendingInteractionPending(interactionId: string, responseJson?: string | null): void;
  markPendingInteractionAnswered(interactionId: string, responseJson: string): void;
  markPendingInteractionCanceled(
    interactionId: string,
    responseJson?: string | null,
    reason?: string | null
  ): void;
  markPendingInteractionFailed(interactionId: string, reason: string): void;
  markPendingInteractionExpired(interactionId: string, reason: string): void;
  expirePendingInteractionsForTurn(threadId: string, turnId: string, reason: string): number;
}

export function createStorePendingInteractions(db: DatabaseSync): StorePendingInteractions {
  return {
    createPendingInteraction(options) {
      const interactionId = options.interactionId ?? randomUUID();
      const chatId = resolveChatId(options);
      const messageId = resolveMessageId(options);
      const requestId = createStoredServerRequestId(options.requestId);
      const timestamp = nowIso();
      db
        .prepare(
          `
            INSERT INTO pending_interaction (
              interaction_id,
              chat_id,
              session_id,
              thread_id,
              turn_id,
              request_id,
              request_id_canonical,
              request_id_legacy,
              request_id_kind,
              request_method,
              interaction_kind,
              state,
              prompt_json,
              response_json,
              message_id,
              created_at,
              updated_at,
              resolved_at,
              error_reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
          `
        )
        .run(
          interactionId,
          chatId,
          options.sessionId,
          options.threadId,
          options.turnId,
          requestId.canonical,
          requestId.canonical,
          requestId.legacy,
          requestId.kind,
          options.requestMethod,
          options.interactionKind,
          options.state ?? "pending",
          options.promptJson,
          options.responseJson ?? null,
          messageId,
          timestamp,
          timestamp,
          options.errorReason ?? null
        );

      return {
        interactionId,
        chatId,
        sessionId: options.sessionId,
        threadId: options.threadId,
        turnId: options.turnId,
        requestId: requestId.value,
        requestMethod: options.requestMethod,
        interactionKind: options.interactionKind,
        state: options.state ?? "pending",
        promptJson: options.promptJson,
        responseJson: options.responseJson ?? null,
        messageId,
        createdAt: timestamp,
        updatedAt: timestamp,
        resolvedAt: null,
        errorReason: options.errorReason ?? null
      } as PendingInteractionRow;
    },

    getPendingInteraction(interactionId, chatId) {
      const row = chatId
        ? db
          .prepare(
            `
              SELECT *
              FROM pending_interaction
              WHERE interaction_id = ? AND chat_id = ?
            `
          )
          .get(interactionId, chatId)
        : db
          .prepare(
            `
              SELECT *
              FROM pending_interaction
              WHERE interaction_id = ?
            `
          )
          .get(interactionId);

      return row ? mapPendingInteraction(row as unknown as PendingInteractionRecord) : null;
    },

    listPendingInteractionsByRequest(threadId, requestId) {
      const stored = createStoredServerRequestId(requestId);
      const rows = db
        .prepare(
          `
            SELECT *
            FROM pending_interaction
            WHERE thread_id = ?
              AND (
                (
                  request_id_kind = ?
                  AND request_id_canonical = ?
                )
                OR (
                  ? IS NOT NULL
                  AND request_id_kind = 'string'
                  AND request_id_legacy = ?
                )
                OR (
                  request_id_kind IS NULL
                  AND request_id IN (${buildInClausePlaceholders(stored.legacy ? 2 : 1)})
                )
              )
              AND state IN ('pending', 'awaiting_text')
            ORDER BY created_at DESC, interaction_id DESC
          `
        )
        .all(
          threadId,
          stored.kind,
          stored.canonical,
          stored.legacy,
          stored.legacy,
          ...(stored.legacy ? [stored.canonical, stored.legacy] : [stored.canonical])
        ) as unknown as PendingInteractionRecord[];

      return rows.map(mapPendingInteraction);
    },

    listPendingInteractionsByChat(chatId, states) {
      const rows = states && states.length > 0
        ? db
          .prepare(
            `
              SELECT *
              FROM pending_interaction
              WHERE chat_id = ?
                AND state IN (${states.map(() => "?").join(", ")})
              ORDER BY created_at DESC, interaction_id DESC
            `
          )
          .all(chatId, ...states)
        : db
          .prepare(
            `
              SELECT *
              FROM pending_interaction
              WHERE chat_id = ?
              ORDER BY created_at DESC, interaction_id DESC
            `
          )
          .all(chatId);

      return (rows as unknown as PendingInteractionRecord[]).map(mapPendingInteraction);
    },

    listActionableUnsurfacedPendingInteractionsForSession(chatId, sessionId) {
      const rows = db
        .prepare(
          `
            SELECT *
            FROM pending_interaction
            WHERE chat_id = ?
              AND session_id = ?
              AND state IN ('pending', 'awaiting_text')
              AND message_id IS NULL
            ORDER BY created_at ASC, rowid ASC
          `
        )
        .all(chatId, sessionId) as unknown as PendingInteractionRecord[];

      return rows.map(mapPendingInteraction);
    },

    listPendingInteractionsByTurn(threadId, turnId) {
      const rows = db
        .prepare(
          `
            SELECT *
            FROM pending_interaction
            WHERE thread_id = ? AND turn_id = ?
            ORDER BY created_at DESC, interaction_id DESC
          `
        )
        .all(threadId, turnId) as unknown as PendingInteractionRecord[];

      return rows.map(mapPendingInteraction);
    },

    clearPendingInteractionsByChat(chatId) {
      db
        .prepare(
          `
            DELETE FROM pending_interaction
            WHERE chat_id = ?
          `
        )
        .run(chatId);
    },

    listUnresolvedPendingInteractions() {
      const rows = db
        .prepare(
          `
            SELECT *
            FROM pending_interaction
            WHERE state IN ('pending', 'awaiting_text')
            ORDER BY created_at ASC, interaction_id ASC
          `
        )
        .all() as unknown as PendingInteractionRecord[];

      return rows.map(mapPendingInteraction);
    },

    listPendingInteractionsForRunningSessions() {
      const rows = db
        .prepare(
          `
            SELECT pi.*
            FROM pending_interaction pi
            INNER JOIN session s
              ON s.session_id = pi.session_id
            WHERE s.status = 'running'
              AND pi.state IN ('pending', 'awaiting_text')
            ORDER BY pi.created_at ASC, pi.interaction_id ASC
          `
        )
        .all() as unknown as PendingInteractionRecord[];

      return rows.map(mapPendingInteraction);
    },

    rebindPendingInteractionsChatIds(chatId, previousChatIds) {
      if (previousChatIds.length === 0) {
        return;
      }

      const placeholders = buildInClausePlaceholders(previousChatIds.length);
      db
        .prepare(
          `
            UPDATE pending_interaction
            SET chat_id = ?
            WHERE chat_id IN (${placeholders})
          `
        )
        .run(chatId, ...previousChatIds);
    },

    clearAllPendingInteractions() {
      db.prepare("DELETE FROM pending_interaction").run();
    },

    failPendingInteractionsForSessionIds(sessionIds, timestamp, reason) {
      if (sessionIds.length === 0) {
        return;
      }

      const placeholders = buildInClausePlaceholders(sessionIds.length);
      db
        .prepare(
          `
            UPDATE pending_interaction
            SET
              state = 'failed',
              updated_at = ?,
              resolved_at = COALESCE(resolved_at, ?),
              error_reason = COALESCE(error_reason, ?)
            WHERE state IN ('pending', 'awaiting_text')
              AND session_id IN (${placeholders})
          `
        )
        .run(timestamp, timestamp, reason, ...sessionIds);
    },

    setPendingInteractionMessageId(interactionId, messageId) {
      db
        .prepare(
          `
            UPDATE pending_interaction
            SET message_id = ?, updated_at = ?
            WHERE interaction_id = ?
          `
        )
        .run(messageId, nowIso(), interactionId);
    },

    savePendingInteractionDraftResponse(interactionId, state, responseJson) {
      if (state !== "pending" && state !== "awaiting_text") {
        throw new Error("draft interaction state must be pending or awaiting_text");
      }

      db
        .prepare(
          `
            UPDATE pending_interaction
            SET
              state = ?,
              response_json = ?,
              updated_at = ?,
              resolved_at = NULL,
              error_reason = NULL
            WHERE interaction_id = ?
          `
        )
        .run(state, responseJson, nowIso(), interactionId);
    },

    markPendingInteractionAwaitingText(interactionId, responseJson) {
      this.savePendingInteractionDraftResponse(interactionId, "awaiting_text", responseJson ?? null);
    },

    markPendingInteractionPending(interactionId, responseJson) {
      this.savePendingInteractionDraftResponse(interactionId, "pending", responseJson ?? null);
    },

    markPendingInteractionAnswered(interactionId, responseJson) {
      const timestamp = nowIso();
      db
        .prepare(
          `
            UPDATE pending_interaction
            SET
              state = 'answered',
              response_json = ?,
              updated_at = ?,
              resolved_at = ?,
              error_reason = NULL
            WHERE interaction_id = ?
          `
        )
        .run(responseJson, timestamp, timestamp, interactionId);
    },

    markPendingInteractionCanceled(interactionId, responseJson, reason) {
      const timestamp = nowIso();
      db
        .prepare(
          `
            UPDATE pending_interaction
            SET
              state = 'canceled',
              response_json = ?,
              updated_at = ?,
              resolved_at = ?,
              error_reason = ?
            WHERE interaction_id = ?
          `
        )
        .run(responseJson ?? null, timestamp, timestamp, reason ?? null, interactionId);
    },

    markPendingInteractionFailed(interactionId, reason) {
      const timestamp = nowIso();
      db
        .prepare(
          `
            UPDATE pending_interaction
            SET
              state = 'failed',
              updated_at = ?,
              resolved_at = ?,
              error_reason = ?
            WHERE interaction_id = ?
          `
        )
        .run(timestamp, timestamp, reason, interactionId);
    },

    markPendingInteractionExpired(interactionId, reason) {
      const timestamp = nowIso();
      db
        .prepare(
          `
            UPDATE pending_interaction
            SET
              state = 'expired',
              updated_at = ?,
              resolved_at = COALESCE(resolved_at, ?),
              error_reason = COALESCE(error_reason, ?)
            WHERE interaction_id = ?
          `
        )
        .run(timestamp, timestamp, reason, interactionId);
    },

    expirePendingInteractionsForTurn(threadId, turnId, reason) {
      const timestamp = nowIso();
      const info = db
        .prepare(
          `
            UPDATE pending_interaction
            SET
              state = 'expired',
              updated_at = ?,
              resolved_at = COALESCE(resolved_at, ?),
              error_reason = COALESCE(error_reason, ?)
            WHERE thread_id = ?
              AND turn_id = ?
              AND state IN ('pending', 'awaiting_text')
          `
        )
        .run(timestamp, timestamp, reason, threadId, turnId);

      return Number(info.changes ?? 0);
    }
  };
}
