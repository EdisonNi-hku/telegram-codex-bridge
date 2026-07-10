import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import { DEFAULT_RUNTIME_STATUS_FIELDS, normalizeReadinessSnapshot } from "../types.js";
import type {
  CommandPanelPreferencesRow,
  CurrentSessionCardRow,
  ReadinessSnapshot,
  RuntimeCardPreferencesRow,
  RuntimeNotice,
  RuntimeStatusField,
  TerminalResultViewRow,
  TurnInputSourceKind,
  TurnInputSourceRow,
  UiLanguage
} from "../types.js";
import { nowIso } from "../util/time.js";
import {
  migrateRuntimeStatusFields,
  parseRuntimeStatusFields,
  shouldMigrateRuntimeStatusFields
} from "./store-open.js";
import { buildInClausePlaceholders } from "./store-shared.js";

interface RuntimeNoticeRecord {
  key: string;
  chat_id: string;
  type: "bridge_restart_recovery" | "app_server_notice" | "terminal_delivery_deferred";
  message: string;
  parse_mode: "HTML" | null;
  reply_markup_json: string | null;
  session_id: string | null;
  turn_id: string | null;
  created_at: string;
}

interface TerminalResultViewRecord {
  answer_id: string;
  chat_id: string;
  delivery_message_id: number | null;
  session_id: string;
  thread_id: string;
  turn_id: string;
  kind: TerminalResultViewRow["kind"];
  delivery_state: TerminalResultViewRow["deliveryState"];
  preview_html: string;
  pages_json: string;
  primary_action_consumed: number;
  created_at: string;
}

interface CurrentSessionCardRecord {
  chat_id: string;
  message_id: number | null;
  session_id: string;
  updated_at: string;
}

interface RuntimeCardPreferencesRecord {
  key: "global";
  fields_json: string;
  updated_at: string;
}

interface UiLanguageRecord {
  key: "global";
  ui_language: UiLanguage;
  updated_at: string;
}

interface CommandPanelPreferencesRecord {
  chat_id: string;
  commands_json: string;
  updated_at: string;
}

interface TurnInputSourceRecord {
  thread_id: string;
  turn_id: string;
  source_kind: TurnInputSourceKind;
  transcript: string;
  created_at: string;
}

interface ReadinessRecord {
  readiness_state: ReadinessSnapshot["state"];
  details_json: string;
  checked_at: string;
  app_server_pid: string | null;
}

function mapRuntimeNotice(record: RuntimeNoticeRecord): RuntimeNotice {
  return {
    key: record.key,
    chatId: record.chat_id,
    type: record.type,
    message: record.message,
    parseMode: record.parse_mode,
    replyMarkup: record.reply_markup_json
      ? JSON.parse(record.reply_markup_json) as TelegramInlineKeyboardMarkup
      : null,
    sessionId: record.session_id,
    turnId: record.turn_id,
    createdAt: record.created_at
  };
}

function mapTerminalResultView(record: TerminalResultViewRecord): TerminalResultViewRow {
  return {
    answerId: record.answer_id,
    chatId: record.chat_id,
    deliveryMessageId: record.delivery_message_id,
    sessionId: record.session_id,
    threadId: record.thread_id,
    turnId: record.turn_id,
    kind: record.kind === "plan_result" ? "plan_result" : "final_answer",
    deliveryState: record.delivery_state === "visible"
      ? "visible"
      : record.delivery_state === "held_for_side"
        ? "held_for_side"
      : record.delivery_state === "deferred_notice_visible"
        ? "deferred_notice_visible"
        : "pending",
    previewHtml: record.preview_html,
    pages: JSON.parse(record.pages_json) as string[],
    primaryActionConsumed: record.primary_action_consumed === 1,
    createdAt: record.created_at
  };
}

function mapCurrentSessionCard(record: CurrentSessionCardRecord): CurrentSessionCardRow {
  return {
    chatId: record.chat_id,
    messageId: record.message_id,
    sessionId: record.session_id,
    updatedAt: record.updated_at
  };
}

function resolveChatId(options: { chatId: string }): string {
  return options.chatId;
}

function resolveMessageId(messageId?: number | null | undefined): number | null {
  return messageId ?? null;
}

function mapRuntimeCardPreferences(record: RuntimeCardPreferencesRecord): RuntimeCardPreferencesRow {
  const fields = shouldMigrateRuntimeStatusFields(record.updated_at)
    ? migrateRuntimeStatusFields(record.fields_json) ?? parseRuntimeStatusFields(record.fields_json)
    : parseRuntimeStatusFields(record.fields_json);

  return {
    key: "global",
    fields,
    updatedAt: record.updated_at
  };
}

function mapUiLanguage(record: UiLanguageRecord): UiLanguage {
  return record.ui_language === "en" ? "en" : "zh";
}

function mapTurnInputSource(record: TurnInputSourceRecord): TurnInputSourceRow {
  return {
    threadId: record.thread_id,
    turnId: record.turn_id,
    sourceKind: record.source_kind,
    transcript: record.transcript,
    createdAt: record.created_at
  };
}

function mapCommandPanelPreferences(record: CommandPanelPreferencesRecord): CommandPanelPreferencesRow {
  let commands: string[] = [];
  try {
    const parsed = JSON.parse(record.commands_json) as unknown;
    if (Array.isArray(parsed)) {
      commands = parsed.filter((value): value is string => typeof value === "string");
    }
  } catch {
    commands = [];
  }

  return {
    chatId: record.chat_id,
    commands,
    updatedAt: record.updated_at
  };
}

export interface StoreRuntimeArtifacts {
  listRuntimeNotices(chatId: string): RuntimeNotice[];
  countRuntimeNotices(): number;
  clearRuntimeNotice(key: string): void;
  upsertRuntimeNotices(notices: RuntimeNotice[]): void;
  createRuntimeNotice(options: {
    key?: string;
    chatId: string;
    type: RuntimeNotice["type"];
    message: string;
    parseMode?: RuntimeNotice["parseMode"];
    replyMarkup?: RuntimeNotice["replyMarkup"];
    sessionId?: string | null;
    turnId?: string | null;
  }): RuntimeNotice;
  listNoticeChatIds(): string[];
  rebindRuntimeNoticesChatIds(chatId: string, previousChatIds: string[]): void;
  getRuntimeCardPreferences(): RuntimeCardPreferencesRow;
  setRuntimeCardPreferences(fields: RuntimeStatusField[]): RuntimeCardPreferencesRow;
  getUiLanguage(): UiLanguage;
  setUiLanguage(language: UiLanguage): UiLanguage;
  getCommandPanelPreferences(chatId: string): CommandPanelPreferencesRow | null;
  setCommandPanelPreferences(chatId: string, commands: string[]): CommandPanelPreferencesRow;
  deleteCommandPanelPreferences(chatId: string): void;
  rebindCommandPanelPreferencesChatIds(chatId: string, previousChatIds: string[]): void;
  getCurrentSessionCard(chatId: string): CurrentSessionCardRow | null;
  upsertCurrentSessionCard(options: {
    chatId: string;
    messageId?: number | null;
    sessionId: string;
  }): CurrentSessionCardRow;
  deleteCurrentSessionCard(chatId: string): void;
  rebindCurrentSessionCardsChatIds(chatId: string, previousChatIds: string[]): void;
  clearAllCurrentSessionCards(): void;
  rebindTerminalResultViewsChatIds(chatId: string, previousChatIds: string[]): void;
  saveTerminalResultView(options: {
    answerId?: string;
    chatId: string;
    deliveryMessageId?: number | null;
    sessionId: string;
    threadId: string;
    turnId: string;
    kind?: TerminalResultViewRow["kind"];
    deliveryState?: TerminalResultViewRow["deliveryState"];
    previewHtml: string;
    pages: string[];
    primaryActionConsumed?: boolean;
  }): TerminalResultViewRow;
  getTerminalResultView(answerId: string, chatId: string): TerminalResultViewRow | null;
  listTerminalResultViews(chatId: string): TerminalResultViewRow[];
  rebindFinalAnswerViewsChatIds(chatId: string, previousChatIds: string[]): void;
  setTerminalResultMessageId(answerId: string, messageId: number): void;
  setTerminalResultDeliveryState(answerId: string, deliveryState: TerminalResultViewRow["deliveryState"]): void;
  setTerminalResultPrimaryActionConsumed(answerId: string, consumed: boolean): void;
  deleteTerminalResultView(answerId: string): void;
  countHeldTerminalResults(sessionId: string): number;
  claimHeldTerminalResults(sessionId: string): TerminalResultViewRow[];
  saveFinalAnswerView(options: {
    answerId?: string;
    chatId: string;
    deliveryMessageId?: number | null;
    sessionId: string;
    threadId: string;
    turnId: string;
    kind?: TerminalResultViewRow["kind"];
    deliveryState?: TerminalResultViewRow["deliveryState"];
    previewHtml: string;
    pages: string[];
    primaryActionConsumed?: boolean;
  }): TerminalResultViewRow;
  getFinalAnswerView(answerId: string, chatId: string): TerminalResultViewRow | null;
  listFinalAnswerViews(chatId: string): TerminalResultViewRow[];
  setFinalAnswerMessageId(answerId: string, messageId: number): void;
  setFinalAnswerDeliveryState(answerId: string, deliveryState: TerminalResultViewRow["deliveryState"]): void;
  setFinalAnswerPrimaryActionConsumed(answerId: string, consumed: boolean): void;
  deleteFinalAnswerView(answerId: string): void;
  clearAllFinalAnswerViews(): void;
  saveTurnInputSource(options: {
    threadId: string;
    turnId: string;
    sourceKind: TurnInputSourceKind;
    transcript: string;
  }): TurnInputSourceRow;
  getTurnInputSource(threadId: string, turnId: string): TurnInputSourceRow | null;
  writeReadinessSnapshot(snapshot: ReadinessSnapshot): void;
  getReadinessSnapshot(): ReadinessSnapshot | null;
}

export function createStoreRuntimeArtifacts(db: DatabaseSync): StoreRuntimeArtifacts {
  const getCurrentSessionCard = (chatId: string): CurrentSessionCardRow | null => {
    const row = db
      .prepare(
        `
          SELECT *
          FROM current_session_card
          WHERE chat_id = ?
        `
      )
      .get(chatId) as CurrentSessionCardRecord | undefined;

    return row ? mapCurrentSessionCard(row) : null;
  };

  const getTerminalResultView = (answerId: string, chatId: string): TerminalResultViewRow | null => {
    const row = db
      .prepare(
        `
          SELECT *
          FROM final_answer_view
          WHERE answer_id = ? AND chat_id = ?
        `
      )
      .get(answerId, chatId) as TerminalResultViewRecord | undefined;

    return row ? mapTerminalResultView(row) : null;
  };

  return {
    listRuntimeNotices(chatId) {
      const rows = db
        .prepare(
          `
            SELECT *
            FROM runtime_notice
            WHERE chat_id = ?
            ORDER BY created_at ASC
          `
        )
        .all(chatId) as unknown as RuntimeNoticeRecord[];

      return rows.map(mapRuntimeNotice);
    },

    countRuntimeNotices() {
      const row = db
        .prepare("SELECT COUNT(*) AS count FROM runtime_notice")
        .get() as { count: number | bigint } | undefined;

      return Number(row?.count ?? 0);
    },

    clearRuntimeNotice(key) {
      db.prepare("DELETE FROM runtime_notice WHERE key = ?").run(key);
    },

    upsertRuntimeNotices(notices) {
      const statement = db.prepare(
        `
          INSERT OR REPLACE INTO runtime_notice (
            key,
            chat_id,
            type,
            message,
            parse_mode,
            reply_markup_json,
            session_id,
            turn_id,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      );

      for (const notice of notices) {
        statement.run(
          notice.key,
          notice.chatId,
          notice.type,
          notice.message,
          notice.parseMode ?? null,
          notice.replyMarkup ? JSON.stringify(notice.replyMarkup) : null,
          notice.sessionId ?? null,
          notice.turnId ?? null,
          notice.createdAt
        );
      }
    },

    createRuntimeNotice(options) {
      const chatId = resolveChatId(options);
      const notice: RuntimeNotice = {
        key: options.key ?? `notice:${randomUUID()}`,
        chatId,
        type: options.type,
        message: options.message,
        parseMode: options.parseMode ?? null,
        replyMarkup: options.replyMarkup ?? null,
        sessionId: options.sessionId ?? null,
        turnId: options.turnId ?? null,
        createdAt: nowIso()
      };

      db
        .prepare(
          `
            INSERT OR REPLACE INTO runtime_notice (
              key,
              chat_id,
              type,
              message,
              parse_mode,
              reply_markup_json,
              session_id,
              turn_id,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          notice.key,
          notice.chatId,
          notice.type,
          notice.message,
          notice.parseMode ?? null,
          notice.replyMarkup ? JSON.stringify(notice.replyMarkup) : null,
          notice.sessionId ?? null,
          notice.turnId ?? null,
          notice.createdAt
        );

      return notice;
    },

    listNoticeChatIds() {
      const rows = db
        .prepare("SELECT DISTINCT chat_id FROM runtime_notice ORDER BY chat_id ASC")
        .all() as Array<{ chat_id: string }>;

      return rows.map((row) => row.chat_id);
    },

    rebindRuntimeNoticesChatIds(chatId, previousChatIds) {
      if (previousChatIds.length === 0) {
        return;
      }

      const placeholders = buildInClausePlaceholders(previousChatIds.length);
      db
        .prepare(
          `
            UPDATE runtime_notice
            SET chat_id = ?
            WHERE chat_id IN (${placeholders})
          `
        )
        .run(chatId, ...previousChatIds);
    },

    getRuntimeCardPreferences() {
      const row = db
        .prepare(
          `
            SELECT *
            FROM runtime_card_preferences
            WHERE key = 'global'
          `
        )
        .get() as RuntimeCardPreferencesRecord | undefined;

      if (row) {
        return mapRuntimeCardPreferences(row);
      }

      return {
        key: "global",
        fields: [...DEFAULT_RUNTIME_STATUS_FIELDS],
        updatedAt: nowIso()
      };
    },

    setRuntimeCardPreferences(fields) {
      const updatedAt = nowIso();
      const uniqueFields = [...new Set(fields)];

      db
        .prepare(
          `
            INSERT OR REPLACE INTO runtime_card_preferences (
              key,
              fields_json,
              updated_at
            )
            VALUES ('global', ?, ?)
          `
        )
        .run(JSON.stringify(uniqueFields), updatedAt);

      return {
        key: "global",
        fields: uniqueFields,
        updatedAt
      };
    },

    getUiLanguage() {
      const row = db
        .prepare(
          `
            SELECT *
            FROM bridge_settings
            WHERE key = 'global'
          `
        )
        .get() as UiLanguageRecord | undefined;

      return row ? mapUiLanguage(row) : "zh";
    },

    setUiLanguage(language) {
      const updatedAt = nowIso();
      const next = language === "en" ? "en" : "zh";

      db
        .prepare(
          `
            INSERT OR REPLACE INTO bridge_settings (
              key,
              ui_language,
              updated_at
            )
            VALUES ('global', ?, ?)
          `
        )
        .run(next, updatedAt);

      return next;
    },

    getCommandPanelPreferences(chatId) {
      const row = db
        .prepare(
          `
            SELECT *
            FROM command_panel_preferences
            WHERE chat_id = ?
          `
        )
        .get(chatId) as CommandPanelPreferencesRecord | undefined;

      return row ? mapCommandPanelPreferences(row) : null;
    },

    setCommandPanelPreferences(chatId, commands) {
      const updatedAt = nowIso();
      const uniqueCommands = [...new Set(commands)];

      db
        .prepare(
          `
            INSERT OR REPLACE INTO command_panel_preferences (
              chat_id,
              commands_json,
              updated_at
            )
            VALUES (?, ?, ?)
          `
        )
        .run(chatId, JSON.stringify(uniqueCommands), updatedAt);

      const saved = this.getCommandPanelPreferences(chatId);
      if (!saved) {
        throw new Error(`persisted command panel preferences missing after save: ${chatId}`);
      }

      return saved;
    },

    deleteCommandPanelPreferences(chatId) {
      db.prepare("DELETE FROM command_panel_preferences WHERE chat_id = ?").run(chatId);
    },

    rebindCommandPanelPreferencesChatIds(chatId, previousChatIds) {
      if (previousChatIds.length === 0) {
        return;
      }

      const allChatIds = [chatId, ...previousChatIds];
      const allPlaceholders = buildInClausePlaceholders(allChatIds.length);
      const latest = db
        .prepare(
          `
            SELECT *
            FROM command_panel_preferences
            WHERE chat_id IN (${allPlaceholders})
            ORDER BY updated_at DESC, rowid DESC
            LIMIT 1
          `
        )
        .get(...allChatIds) as CommandPanelPreferencesRecord | undefined;
      const previousPlaceholders = buildInClausePlaceholders(previousChatIds.length);

      db
        .prepare(
          `
            DELETE FROM command_panel_preferences
            WHERE chat_id IN (${previousPlaceholders})
          `
        )
        .run(...previousChatIds);

      if (latest && latest.chat_id !== chatId) {
        db
          .prepare(
            `
              INSERT OR REPLACE INTO command_panel_preferences (
                chat_id,
                commands_json,
                updated_at
              )
              VALUES (?, ?, ?)
            `
          )
          .run(chatId, latest.commands_json, latest.updated_at);
      }
    },

    getCurrentSessionCard,

    upsertCurrentSessionCard(options) {
      const chatId = resolveChatId(options);
      const messageId = resolveMessageId(options.messageId);
      const updatedAt = nowIso();
      db
        .prepare(
          `
            INSERT OR REPLACE INTO current_session_card (
              chat_id,
              message_id,
              session_id,
              updated_at
            )
            VALUES (?, ?, ?, ?)
          `
        )
        .run(
          chatId,
          messageId,
          options.sessionId,
          updatedAt
        );

      const saved = getCurrentSessionCard(chatId);
      if (!saved) {
        throw new Error(`persisted current session card missing after save: ${chatId}`);
      }

      return saved;
    },

    deleteCurrentSessionCard(chatId) {
      db.prepare("DELETE FROM current_session_card WHERE chat_id = ?").run(chatId);
    },

    rebindCurrentSessionCardsChatIds(chatId, previousChatIds) {
      if (previousChatIds.length === 0) {
        return;
      }

      const placeholders = buildInClausePlaceholders(previousChatIds.length);
      db
        .prepare(
          `
            UPDATE current_session_card
            SET chat_id = ?
            WHERE chat_id IN (${placeholders})
          `
        )
        .run(chatId, ...previousChatIds);
    },

    clearAllCurrentSessionCards() {
      db.prepare("DELETE FROM current_session_card").run();
    },

    saveTerminalResultView(options) {
      const answerId = options.answerId ?? randomUUID();
      const chatId = resolveChatId(options);
      const deliveryMessageId = resolveMessageId(options.deliveryMessageId);
      const createdAt = nowIso();

      db.exec("BEGIN");

      try {
        db
          .prepare(
            `
              INSERT OR REPLACE INTO final_answer_view (
                answer_id,
                chat_id,
                delivery_message_id,
                session_id,
                thread_id,
                turn_id,
                kind,
                delivery_state,
                preview_html,
                pages_json,
                primary_action_consumed,
                created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            answerId,
            chatId,
            deliveryMessageId,
            options.sessionId,
            options.threadId,
            options.turnId,
            options.kind ?? "final_answer",
            options.deliveryState ?? "pending",
            options.previewHtml,
            JSON.stringify(options.pages),
            options.primaryActionConsumed ? 1 : 0,
            createdAt
          );

        db
          .prepare(
            `
              DELETE FROM final_answer_view
              WHERE answer_id IN (
                SELECT answer_id
                FROM final_answer_view
                WHERE chat_id = ?
                ORDER BY created_at DESC, rowid DESC
                LIMIT -1 OFFSET 50
              )
            `
          )
          .run(chatId);

        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      const saved = getTerminalResultView(answerId, chatId);
      if (!saved) {
        throw new Error(`persisted terminal result view missing after save: ${answerId}`);
      }

      return saved;
    },

    getTerminalResultView,

    listTerminalResultViews(chatId) {
      const rows = db
        .prepare(
          `
            SELECT *
            FROM final_answer_view
            WHERE chat_id = ?
            ORDER BY created_at DESC, rowid DESC
          `
        )
        .all(chatId) as unknown as TerminalResultViewRecord[];

      return rows.map(mapTerminalResultView);
    },

    countHeldTerminalResults(sessionId) {
      const row = db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM final_answer_view
            WHERE session_id = ? AND delivery_state = 'held_for_side'
          `
        )
        .get(sessionId) as { count: number | bigint };
      return Number(row.count);
    },

    claimHeldTerminalResults(sessionId) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const rows = db
          .prepare(
            `
              SELECT *
              FROM final_answer_view
              WHERE session_id = ? AND delivery_state = 'held_for_side'
              ORDER BY created_at ASC, rowid ASC
            `
          )
          .all(sessionId) as unknown as TerminalResultViewRecord[];
        if (rows.length > 0) {
          const placeholders = buildInClausePlaceholders(rows.length);
          const transitioned = db
            .prepare(
              `
                UPDATE final_answer_view
                SET delivery_state = 'pending'
                WHERE delivery_state = 'held_for_side'
                  AND answer_id IN (${placeholders})
              `
            )
            .run(...rows.map((row) => row.answer_id));
          if (Number(transitioned.changes ?? 0) !== rows.length) {
            throw new Error("held terminal result claim transition count mismatch");
          }
        }
        db.exec("COMMIT");
        return rows.map((row) => mapTerminalResultView({ ...row, delivery_state: "pending" }));
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    rebindTerminalResultViewsChatIds(chatId, previousChatIds) {
      if (previousChatIds.length === 0) {
        return;
      }

      const placeholders = buildInClausePlaceholders(previousChatIds.length);
      db
        .prepare(
          `
            UPDATE final_answer_view
            SET chat_id = ?
            WHERE chat_id IN (${placeholders})
          `
        )
        .run(chatId, ...previousChatIds);
    },

    rebindFinalAnswerViewsChatIds(chatId, previousChatIds) {
      this.rebindTerminalResultViewsChatIds(chatId, previousChatIds);
    },

    setTerminalResultMessageId(answerId, messageId) {
      db
        .prepare(
          `
            UPDATE final_answer_view
            SET delivery_message_id = ?
            WHERE answer_id = ?
          `
        )
        .run(messageId, answerId);
    },

    setTerminalResultDeliveryState(answerId, deliveryState) {
      db
        .prepare(
          `
            UPDATE final_answer_view
            SET delivery_state = ?
            WHERE answer_id = ?
          `
        )
        .run(deliveryState, answerId);
    },

    setTerminalResultPrimaryActionConsumed(answerId, consumed) {
      db
        .prepare(
          `
            UPDATE final_answer_view
            SET primary_action_consumed = ?
            WHERE answer_id = ?
          `
        )
        .run(consumed ? 1 : 0, answerId);
    },

    deleteTerminalResultView(answerId) {
      db.prepare("DELETE FROM final_answer_view WHERE answer_id = ?").run(answerId);
    },

    saveFinalAnswerView(options) {
      return this.saveTerminalResultView(options);
    },

    getFinalAnswerView(answerId, chatId) {
      return this.getTerminalResultView(answerId, chatId);
    },

    listFinalAnswerViews(chatId) {
      return this.listTerminalResultViews(chatId);
    },

    setFinalAnswerMessageId(answerId, messageId) {
      this.setTerminalResultMessageId(answerId, messageId);
    },

    setFinalAnswerDeliveryState(answerId, deliveryState) {
      this.setTerminalResultDeliveryState(answerId, deliveryState);
    },

    setFinalAnswerPrimaryActionConsumed(answerId, consumed) {
      this.setTerminalResultPrimaryActionConsumed(answerId, consumed);
    },

    deleteFinalAnswerView(answerId) {
      this.deleteTerminalResultView(answerId);
    },

    clearAllFinalAnswerViews() {
      db.prepare("DELETE FROM final_answer_view").run();
    },

    saveTurnInputSource(options) {
      const record: TurnInputSourceRow = {
        threadId: options.threadId,
        turnId: options.turnId,
        sourceKind: options.sourceKind,
        transcript: options.transcript,
        createdAt: nowIso()
      };

      db
        .prepare(
          `
            INSERT OR REPLACE INTO turn_input_source (
              thread_id,
              turn_id,
              source_kind,
              transcript,
              created_at
            )
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(record.threadId, record.turnId, record.sourceKind, record.transcript, record.createdAt);

      return record;
    },

    getTurnInputSource(threadId, turnId) {
      const row = db
        .prepare(
          `
            SELECT *
            FROM turn_input_source
            WHERE thread_id = ? AND turn_id = ?
          `
        )
        .get(threadId, turnId) as TurnInputSourceRecord | undefined;

      return row ? mapTurnInputSource(row) : null;
    },

    writeReadinessSnapshot(snapshot) {
      db
        .prepare(
          `
            INSERT OR REPLACE INTO bootstrap_state (
              key,
              readiness_state,
              details_json,
              checked_at,
              app_server_pid
            )
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(
          "bootstrap",
          snapshot.state,
          JSON.stringify(snapshot.details),
          snapshot.checkedAt,
          snapshot.appServerPid ?? null
        );
    },

    getReadinessSnapshot() {
      const row = db
        .prepare(
          `
            SELECT readiness_state, details_json, checked_at, app_server_pid
            FROM bootstrap_state
            WHERE key = 'bootstrap'
          `
        )
        .get() as ReadinessRecord | undefined;

      if (!row) {
        return null;
      }

      return normalizeReadinessSnapshot({
        state: row.readiness_state,
        checkedAt: row.checked_at,
        details: JSON.parse(row.details_json) as ReadinessSnapshot["details"],
        appServerPid: row.app_server_pid
      });
    }
  };
}
