import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { SessionRow } from "../types.js";
import { nowIso } from "../util/time.js";
import { mapSession, type SessionRecord, sessionSelectColumns } from "./store-records.js";

export interface SideRestartRecovery {
  chatId: string;
  sideSessionId: string;
  parentSessionId: string | null;
}

export interface StoreSideSessions {
  createSideSession(options: { parentSessionId: string; threadId: string }): SessionRow;
  getSideParent(sideSessionId: string): SessionRow | null;
  getActiveSideForParent(parentSessionId: string): SessionRow | null;
  listSideSessions(): SessionRow[];
  restoreParentAndDeleteSide(sideSessionId: string): { side: SessionRow; parent: SessionRow } | null;
  restoreFallbackAndDeleteOrphanedSide(sideSessionId: string): { side: SessionRow; fallback: SessionRow | null } | null;
  recoverSideSessionsAfterRestart(): SideRestartRecovery[];
}

export function createStoreSideSessions(db: DatabaseSync): StoreSideSessions {
  const getSession = (sessionId: string): SessionRow | null => {
    const row = db
      .prepare(
        `
          SELECT
            ${sessionSelectColumns("s", "rp")}
          FROM session s
          LEFT JOIN recent_project rp ON rp.project_path = s.project_path
          WHERE s.session_id = ?
        `
      )
      .get(sessionId) as SessionRecord | undefined;
    return row ? mapSession(row) : null;
  };

  const listSideSessions = (): SessionRow[] => {
    const rows = db
      .prepare(
        `
          SELECT
            ${sessionSelectColumns("s", "rp")}
          FROM session s
          LEFT JOIN recent_project rp ON rp.project_path = s.project_path
          WHERE s.session_kind = 'side'
          ORDER BY s.created_at ASC, s.rowid ASC
        `
      )
      .all() as unknown as SessionRecord[];
    return rows.map(mapSession);
  };

  return {
    createSideSession({ parentSessionId, threadId }) {
      if (threadId.trim().length === 0) {
        throw new Error("side session threadId must not be blank");
      }

      const timestamp = nowIso();
      const sideId = randomUUID();
      db.exec("BEGIN IMMEDIATE");
      try {
        const parent = getSession(parentSessionId);
        if (!parent) throw new Error("side session parent does not exist");
        if (parent.sessionKind !== "regular") throw new Error("side session requires a regular parent");
        if (parent.archived) throw new Error("side session parent is archived");

        const openSide = db
          .prepare(
            `
              SELECT session_id
              FROM session
              WHERE chat_id = ? AND session_kind = 'side' AND archived = 0
              LIMIT 1
            `
          )
          .get(parent.chatId);
        if (openSide) throw new Error("an open side session already exists for chat");

        db
          .prepare(
            `
              INSERT INTO session (
                session_id, session_kind, parent_session_id, chat_id, telegram_chat_id,
                thread_id, selected_model, selected_reasoning_effort, plan_mode,
                pending_default_collaboration_mode_reset, display_name, display_name_source,
                project_name, project_path, status, failure_reason, archived, archived_at,
                created_at, last_used_at, last_turn_id, last_turn_status
              )
              VALUES (
                ?, 'side', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto', ?, ?, 'idle', NULL,
                0, NULL, ?, ?, NULL, NULL
              )
            `
          )
          .run(
            sideId, parent.sessionId, parent.chatId, parent.telegramChatId, threadId,
            parent.selectedModel, parent.selectedReasoningEffort, parent.planMode ? 1 : 0,
            parent.needsDefaultCollaborationModeReset ? 1 : 0, `Side: ${parent.displayName}`,
            parent.projectName, parent.projectPath, timestamp, timestamp
          );

        const bindingUpdate = db
          .prepare(
            `
              UPDATE chat_binding
              SET active_session_id = ?, updated_at = ?
              WHERE chat_id = ? AND active_session_id = ?
            `
          )
          .run(sideId, timestamp, parent.chatId, parent.sessionId);
        if (Number(bindingUpdate.changes ?? 0) !== 1) {
          throw new Error("side session parent is not the active chat binding");
        }

        const side = getSession(sideId);
        if (!side) throw new Error("persisted side session missing before commit");
        db.exec("COMMIT");
        return side;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    getSideParent(sideSessionId) {
      const side = getSession(sideSessionId);
      return side?.sessionKind === "side" && side.parentSessionId
        ? getSession(side.parentSessionId)
        : null;
    },

    getActiveSideForParent(parentSessionId) {
      const row = db
        .prepare(
          `
            SELECT
              ${sessionSelectColumns("s", "rp")}
            FROM session s
            JOIN chat_binding cb
              ON cb.chat_id = s.chat_id AND cb.active_session_id = s.session_id
            LEFT JOIN recent_project rp ON rp.project_path = s.project_path
            WHERE s.session_kind = 'side'
              AND s.parent_session_id = ?
              AND s.archived = 0
            LIMIT 1
          `
        )
        .get(parentSessionId) as SessionRecord | undefined;
      return row ? mapSession(row) : null;
    },

    listSideSessions,

    restoreParentAndDeleteSide(sideSessionId) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const side = getSession(sideSessionId);
        if (!side) {
          db.exec("ROLLBACK");
          return null;
        }
        if (side.sessionKind !== "side") throw new Error("session is not a side session");

        const parent = side.parentSessionId ? getSession(side.parentSessionId) : null;
        if (!parent
          || parent.sessionKind !== "regular"
          || parent.archived
          || parent.chatId !== side.chatId
          || parent.projectPath !== side.projectPath) {
          db.exec("ROLLBACK");
          return null;
        }

        const bindingUpdate = db
          .prepare(
            `
              UPDATE chat_binding
              SET active_session_id = ?, updated_at = ?
              WHERE chat_id = ? AND active_session_id = ?
            `
          )
          .run(parent.sessionId, nowIso(), side.chatId, side.sessionId);
        if (Number(bindingUpdate.changes ?? 0) !== 1) {
          db.exec("ROLLBACK");
          return null;
        }

        const deleted = db
          .prepare("DELETE FROM session WHERE session_id = ? AND session_kind = 'side'")
          .run(side.sessionId);
        if (Number(deleted.changes ?? 0) !== 1) {
          throw new Error("active side session disappeared before delete");
        }
        db.exec("COMMIT");
        return { side, parent };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    restoreFallbackAndDeleteOrphanedSide(sideSessionId) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const side = getSession(sideSessionId);
        if (!side) { db.exec("ROLLBACK"); return null; }
        if (side.sessionKind !== "side") throw new Error("session is not a side session");

        const parent = side.parentSessionId ? getSession(side.parentSessionId) : null;
        const parentIsVisible = parent?.sessionKind === "regular"
          && !parent.archived
          && parent.chatId === side.chatId
          && parent.projectPath === side.projectPath;
        if (parentIsVisible) { db.exec("ROLLBACK"); return null; }

        const fallbackRow = db
          .prepare(
            `
              SELECT
                ${sessionSelectColumns("s", "rp")}
              FROM session s
              LEFT JOIN recent_project rp ON rp.project_path = s.project_path
              WHERE s.chat_id = ? AND s.session_kind = 'regular' AND s.archived = 0
              ORDER BY s.last_used_at DESC, s.created_at DESC, s.rowid DESC
              LIMIT 1
            `
          )
          .get(side.chatId) as SessionRecord | undefined;
        const fallback = fallbackRow ? mapSession(fallbackRow) : null;
        const bindingUpdate = db
          .prepare(
            `
              UPDATE chat_binding
              SET active_session_id = ?, updated_at = ?
              WHERE chat_id = ? AND active_session_id = ?
            `
          )
          .run(fallback?.sessionId ?? null, nowIso(), side.chatId, side.sessionId);
        if (Number(bindingUpdate.changes ?? 0) !== 1) { db.exec("ROLLBACK"); return null; }

        const deleted = db
          .prepare("DELETE FROM session WHERE session_id = ? AND session_kind = 'side'")
          .run(side.sessionId);
        if (Number(deleted.changes ?? 0) !== 1) throw new Error("active orphaned side disappeared before delete");
        db.exec("COMMIT");
        return { side, fallback };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    recoverSideSessionsAfterRestart() {
      db.exec("BEGIN IMMEDIATE");
      try {
        const sides = listSideSessions();
        if (sides.length === 0) {
          db.exec("COMMIT");
          return [];
        }

        const recoveries: SideRestartRecovery[] = [];
        for (const side of sides) {
          const parent = side.parentSessionId ? getSession(side.parentSessionId) : null;
          const validParent = parent?.sessionKind === "regular"
            && !parent.archived
            && parent.chatId === side.chatId
            && parent.projectPath === side.projectPath
            ? parent
            : null;
          const fallbackRow = validParent ? undefined : db
            .prepare(
              `
                SELECT
                  ${sessionSelectColumns("s", "rp")}
                FROM session s
                LEFT JOIN recent_project rp ON rp.project_path = s.project_path
                WHERE s.chat_id = ? AND s.session_kind = 'regular' AND s.archived = 0
                ORDER BY s.last_used_at DESC, s.created_at DESC, s.rowid DESC
                LIMIT 1
              `
            )
            .get(side.chatId) as SessionRecord | undefined;
          const fallback = validParent ?? (fallbackRow ? mapSession(fallbackRow) : null);

          db.prepare(
            `
              UPDATE chat_binding
              SET active_session_id = ?, updated_at = ?
              WHERE chat_id = ? AND active_session_id = ?
            `
          ).run(fallback?.sessionId ?? null, nowIso(), side.chatId, side.sessionId);
          db.prepare(
            `
              INSERT OR IGNORE INTO runtime_notice (key, chat_id, type, message, created_at)
              VALUES (?, ?, 'side_restart_recovery', ?, ?)
            `
          ).run(`side-restart:${side.sessionId}`, side.chatId, "Side 已因服务重启关闭。", nowIso());
          db.prepare("DELETE FROM session WHERE session_id = ? AND session_kind = 'side'").run(side.sessionId);
          recoveries.push({
            chatId: side.chatId,
            sideSessionId: side.sessionId,
            parentSessionId: side.parentSessionId ?? null
          });
        }
        db.exec("COMMIT");
        return recoveries;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
}
