import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import {
  type BridgePlatform,
  resolvePlatformBindingRef,
  resolvePlatformChatRef,
  resolvePlatformUserRef
} from "../core/domain/binding.js";
import type { AuthorizedUserRow, ChatBindingRow, PendingAuthorizationRow } from "../types.js";
import { nowIso } from "../util/time.js";
import {
  type AuthorizedUserRecord,
  type ChatBindingRecord,
  type PendingAuthorizationRecord,
  mapAuthorizedUser,
  mapChatBinding,
  mapPendingAuthorization
} from "./store-records.js";

export interface StoreAuth {
  getAuthorizedUser(platform?: BridgePlatform): AuthorizedUserRow | null;
  getChatBinding(chatId: string, platform?: BridgePlatform): ChatBindingRow | null;
  listChatBindings(platform?: BridgePlatform): ChatBindingRow[];
  listChatBindingsByUserId(userId: string, platform?: BridgePlatform): ChatBindingRow[];
  listPendingAuthorizations(options?: {
    includeExpired?: boolean;
    platform?: BridgePlatform;
  }): PendingAuthorizationRow[];
  upsertPendingAuthorization(candidate: {
    platform?: BridgePlatform;
    userId?: string;
    telegramUserId?: string;
    chatId?: string;
    telegramChatId?: string;
    username?: string | null;
    telegramUsername?: string | null;
    displayName: string | null;
  }): void;
  saveAuthorizedUser(options: {
    platform?: BridgePlatform;
    userId?: string;
    telegramUserId?: string;
    username?: string | null;
    telegramUsername?: string | null;
    displayName: string | null;
    firstSeenAt: string;
    updatedAt: string;
  }): void;
  replaceChatBinding(options: {
    platform?: BridgePlatform;
    chatId?: string;
    telegramChatId?: string;
    userId?: string;
    telegramUserId?: string;
    activeSessionId: string | null;
    createdAt: string;
    updatedAt: string;
  }): void;
  setChatBindingActiveSession(
    chatId: string,
    activeSessionId: string | null,
    updatedAt?: string,
    platform?: BridgePlatform
  ): void;
  deleteChatBindingsByUserId(userId: string, platform?: BridgePlatform): void;
  clearAuthorizedUsers(platform?: BridgePlatform): void;
  clearChatBindings(platform?: BridgePlatform): void;
  clearPendingAuthorizations(platform?: BridgePlatform): void;
}

function buildPlatformWhereClause(platform?: BridgePlatform): {
  clause: string;
  params: SQLInputValue[];
} {
  return platform ? {
    clause: " WHERE platform = ?",
    params: [platform]
  } : {
    clause: "",
    params: []
  };
}

export function createStoreAuth(db: DatabaseSync): StoreAuth {
  return {
    getAuthorizedUser(platform) {
      const filter = buildPlatformWhereClause(platform);
      const row = db
        .prepare(`SELECT * FROM authorized_user${filter.clause} ORDER BY updated_at DESC LIMIT 1`)
        .get(...filter.params) as AuthorizedUserRecord | undefined;

      return row ? mapAuthorizedUser(row) : null;
    },

    getChatBinding(chatId, platform) {
      const filter = buildPlatformWhereClause(platform);
      const row = db
        .prepare(
          `SELECT * FROM chat_binding WHERE chat_id = ?${filter.clause ? " AND platform = ?" : ""}`
        )
        .get(chatId, ...filter.params) as ChatBindingRecord | undefined;

      return row ? mapChatBinding(row) : null;
    },

    listChatBindings(platform) {
      const filter = buildPlatformWhereClause(platform);
      const rows = db
        .prepare(`SELECT * FROM chat_binding${filter.clause} ORDER BY updated_at DESC, created_at DESC`)
        .all(...filter.params) as unknown as ChatBindingRecord[];

      return rows.map(mapChatBinding);
    },

    listChatBindingsByUserId(userId, platform) {
      const filter = buildPlatformWhereClause(platform);
      const rows = db
        .prepare(
          `
            SELECT *
            FROM chat_binding
            WHERE user_id = ?${filter.clause ? " AND platform = ?" : ""}
            ORDER BY updated_at DESC, created_at DESC
          `
        )
        .all(userId, ...filter.params) as unknown as ChatBindingRecord[];

      return rows.map(mapChatBinding);
    },

    listPendingAuthorizations(options) {
      const includeExpired = options?.includeExpired ?? false;
      const filter = buildPlatformWhereClause(options?.platform);
      const rows = db
        .prepare(
          `SELECT * FROM pending_authorization${filter.clause} ORDER BY last_seen_at DESC, first_seen_at DESC`
        )
        .all(...filter.params) as unknown as PendingAuthorizationRecord[];

      return rows
        .map(mapPendingAuthorization)
        .filter((row) => includeExpired || !row.expired);
    },

    upsertPendingAuthorization(candidate) {
      const userRef = resolvePlatformUserRef(candidate);
      const chatRef = resolvePlatformChatRef(candidate);
      const timestamp = nowIso();
      db
        .prepare(
          `
            INSERT INTO pending_authorization (
              platform,
              user_id,
              chat_id,
              username,
              telegram_user_id,
              telegram_chat_id,
              telegram_username,
              display_name,
              first_seen_at,
              last_seen_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform, user_id) DO UPDATE SET
              chat_id = excluded.chat_id,
              username = excluded.username,
              telegram_user_id = excluded.telegram_user_id,
              telegram_chat_id = excluded.telegram_chat_id,
              telegram_username = excluded.telegram_username,
              display_name = excluded.display_name,
              last_seen_at = excluded.last_seen_at
          `
        )
        .run(
          userRef.platform,
          userRef.userId,
          chatRef.chatId,
          userRef.username,
          userRef.userId,
          chatRef.chatId,
          userRef.username,
          candidate.displayName,
          timestamp,
          timestamp
        );
    },

    saveAuthorizedUser(options) {
      const userRef = resolvePlatformUserRef(options);
      db
        .prepare(
          `
            INSERT INTO authorized_user (
              platform,
              user_id,
              username,
              telegram_user_id,
              telegram_username,
              display_name,
              first_seen_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform, user_id) DO UPDATE SET
              username = excluded.username,
              telegram_user_id = excluded.telegram_user_id,
              telegram_username = excluded.telegram_username,
              display_name = excluded.display_name,
              first_seen_at = excluded.first_seen_at,
              updated_at = excluded.updated_at
          `
        )
        .run(
          userRef.platform,
          userRef.userId,
          userRef.username,
          userRef.userId,
          userRef.username,
          options.displayName,
          options.firstSeenAt,
          options.updatedAt
        );
    },

    replaceChatBinding(options) {
      const bindingRef = resolvePlatformBindingRef(options);
      db
        .prepare(
          `
            INSERT INTO chat_binding (
              platform,
              chat_id,
              user_id,
              telegram_chat_id,
              telegram_user_id,
              active_session_id,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform, chat_id) DO UPDATE SET
              user_id = excluded.user_id,
              telegram_chat_id = excluded.telegram_chat_id,
              telegram_user_id = excluded.telegram_user_id,
              active_session_id = excluded.active_session_id,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
          `
        )
        .run(
          bindingRef.platform,
          bindingRef.chatId,
          bindingRef.userId,
          bindingRef.chatId,
          bindingRef.userId,
          options.activeSessionId,
          options.createdAt,
          options.updatedAt
        );
    },

    setChatBindingActiveSession(chatId, activeSessionId, updatedAt = nowIso(), platform) {
      const filter = buildPlatformWhereClause(platform);
      db
        .prepare(
          `
            UPDATE chat_binding
            SET active_session_id = ?, updated_at = ?
            WHERE chat_id = ?${filter.clause ? " AND platform = ?" : ""}
          `
        )
        .run(activeSessionId, updatedAt, chatId, ...filter.params);
    },

    deleteChatBindingsByUserId(userId, platform) {
      const filter = buildPlatformWhereClause(platform);
      db
        .prepare(
          `
            DELETE FROM chat_binding
            WHERE user_id = ?${filter.clause ? " AND platform = ?" : ""}
          `
        )
        .run(userId, ...filter.params);
    },

    clearAuthorizedUsers(platform) {
      const filter = buildPlatformWhereClause(platform);
      db.prepare(`DELETE FROM authorized_user${filter.clause}`).run(...filter.params);
    },

    clearChatBindings(platform) {
      const filter = buildPlatformWhereClause(platform);
      db.prepare(`DELETE FROM chat_binding${filter.clause}`).run(...filter.params);
    },

    clearPendingAuthorizations(platform) {
      const filter = buildPlatformWhereClause(platform);
      db.prepare(`DELETE FROM pending_authorization${filter.clause}`).run(...filter.params);
    }
  };
}
