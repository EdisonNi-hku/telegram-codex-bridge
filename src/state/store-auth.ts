import type { DatabaseSync } from "node:sqlite";

import {
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
  getAuthorizedUser(): AuthorizedUserRow | null;
  getChatBinding(chatId: string): ChatBindingRow | null;
  listChatBindings(): ChatBindingRow[];
  listChatBindingsByUserId(userId: string): ChatBindingRow[];
  listPendingAuthorizations(options?: { includeExpired?: boolean }): PendingAuthorizationRow[];
  upsertPendingAuthorization(candidate: {
    userId?: string;
    telegramUserId?: string;
    chatId?: string;
    telegramChatId?: string;
    username?: string | null;
    telegramUsername?: string | null;
    displayName: string | null;
  }): void;
  saveAuthorizedUser(options: {
    userId?: string;
    telegramUserId?: string;
    username?: string | null;
    telegramUsername?: string | null;
    displayName: string | null;
    firstSeenAt: string;
    updatedAt: string;
  }): void;
  replaceChatBinding(options: {
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
    updatedAt?: string
  ): void;
  deleteChatBindingsByUserId(userId: string): void;
  clearAuthorizedUsers(): void;
  clearChatBindings(): void;
  clearPendingAuthorizations(): void;
}

export function createStoreAuth(db: DatabaseSync): StoreAuth {
  return {
    getAuthorizedUser() {
      const row = db
        .prepare("SELECT * FROM authorized_user ORDER BY updated_at DESC LIMIT 1")
        .get() as AuthorizedUserRecord | undefined;

      return row ? mapAuthorizedUser(row) : null;
    },

    getChatBinding(chatId) {
      const row = db
        .prepare("SELECT * FROM chat_binding WHERE chat_id = ?")
        .get(chatId) as ChatBindingRecord | undefined;

      return row ? mapChatBinding(row) : null;
    },

    listChatBindings() {
      const rows = db
        .prepare("SELECT * FROM chat_binding ORDER BY updated_at DESC, created_at DESC")
        .all() as unknown as ChatBindingRecord[];

      return rows.map(mapChatBinding);
    },

    listChatBindingsByUserId(userId) {
      const rows = db
        .prepare(
          `
            SELECT *
            FROM chat_binding
            WHERE user_id = ?
            ORDER BY updated_at DESC, created_at DESC
          `
        )
        .all(userId) as unknown as ChatBindingRecord[];

      return rows.map(mapChatBinding);
    },

    listPendingAuthorizations(options) {
      const includeExpired = options?.includeExpired ?? false;
      const rows = db
        .prepare(
          "SELECT * FROM pending_authorization ORDER BY last_seen_at DESC, first_seen_at DESC"
        )
        .all() as unknown as PendingAuthorizationRecord[];

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
            VALUES ('telegram', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(telegram_user_id) DO UPDATE SET
              user_id = excluded.user_id,
              chat_id = excluded.chat_id,
              username = excluded.username,
              telegram_chat_id = excluded.telegram_chat_id,
              telegram_username = excluded.telegram_username,
              display_name = excluded.display_name,
              last_seen_at = excluded.last_seen_at
          `
        )
        .run(
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
            INSERT OR REPLACE INTO authorized_user (
              platform,
              user_id,
              username,
              telegram_user_id,
              telegram_username,
              display_name,
              first_seen_at,
              updated_at
            )
            VALUES ('telegram', ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
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
            INSERT OR REPLACE INTO chat_binding (
              platform,
              chat_id,
              user_id,
              telegram_chat_id,
              telegram_user_id,
              active_session_id,
              created_at,
              updated_at
            )
            VALUES ('telegram', ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          bindingRef.chatId,
          bindingRef.userId,
          bindingRef.chatId,
          bindingRef.userId,
          options.activeSessionId,
          options.createdAt,
          options.updatedAt
        );
    },

    setChatBindingActiveSession(chatId, activeSessionId, updatedAt = nowIso()) {
      db
        .prepare(
          `
            UPDATE chat_binding
            SET active_session_id = ?, updated_at = ?
            WHERE chat_id = ?
          `
        )
        .run(activeSessionId, updatedAt, chatId);
    },

    deleteChatBindingsByUserId(userId) {
      db
        .prepare(
          `
            DELETE FROM chat_binding
            WHERE user_id = ?
          `
        )
        .run(userId);
    },

    clearAuthorizedUsers() {
      db.prepare("DELETE FROM authorized_user").run();
    },

    clearChatBindings() {
      db.prepare("DELETE FROM chat_binding").run();
    },

    clearPendingAuthorizations() {
      db.prepare("DELETE FROM pending_authorization").run();
    }
  };
}
