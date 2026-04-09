import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";

import type { Logger } from "../logger.js";
import type { BridgePaths } from "../paths.js";
import { ALL_RUNTIME_STATUS_FIELDS, DEFAULT_RUNTIME_STATUS_FIELDS } from "../types.js";
import type { RuntimeStatusField } from "../types.js";
import { nowIso } from "../util/time.js";
import type {
  StateStoreFailureClassification,
  StateStoreFailureRecord,
  StateStoreOpenStage
} from "./store.js";

interface RuntimeCardPreferencesRecord {
  key: "global";
  fields_json: string;
  updated_at: string;
}

const LEGACY_RUNTIME_STATUS_FIELD_MIGRATIONS: ReadonlyMap<string, RuntimeStatusField> = new Map([
  ["project_path", "current-dir"],
  ["model_reasoning", "model-with-reasoning"],
  ["thread_id", "session-id"]
]);
const RUNTIME_STATUS_FIELD_V4_MIGRATION_CUTOFF = "2026-03-17T00:00:00.000Z";
const CURRENT_SCHEMA_VERSION = 22;

export function parseRuntimeStatusFields(fieldsJson: string): RuntimeStatusField[] {
  try {
    const parsed = JSON.parse(fieldsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_RUNTIME_STATUS_FIELDS];
    }

    const allowed = new Set<RuntimeStatusField>(ALL_RUNTIME_STATUS_FIELDS);
    const fields = parsed.filter((field): field is RuntimeStatusField =>
      typeof field === "string" && allowed.has(field as RuntimeStatusField)
    );
    if (parsed.length === 0) {
      return [];
    }

    return fields.length > 0 ? fields : [...DEFAULT_RUNTIME_STATUS_FIELDS];
  } catch {
    return [...DEFAULT_RUNTIME_STATUS_FIELDS];
  }
}

export function migrateRuntimeStatusFields(fieldsJson: string): RuntimeStatusField[] | null {
  try {
    const parsed = JSON.parse(fieldsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const allowed = new Set<RuntimeStatusField>(ALL_RUNTIME_STATUS_FIELDS);
    const migrated = parsed.flatMap((field): RuntimeStatusField[] => {
      if (typeof field !== "string") {
        return [];
      }

      const mapped = LEGACY_RUNTIME_STATUS_FIELD_MIGRATIONS.get(field) ?? field;
      return allowed.has(mapped as RuntimeStatusField) ? [mapped as RuntimeStatusField] : [];
    });

    if (parsed.length === 0) {
      return [];
    }

    const uniqueFields = [...new Set(migrated)];
    return uniqueFields.length > 0 ? uniqueFields : [...DEFAULT_RUNTIME_STATUS_FIELDS];
  } catch {
    return null;
  }
}

export function shouldMigrateRuntimeStatusFields(updatedAt: string): boolean {
  return updatedAt < RUNTIME_STATUS_FIELD_V4_MIGRATION_CUTOFF;
}

function initialSchema(): string {
  return `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authorized_user (
      platform TEXT NOT NULL DEFAULT 'telegram',
      user_id TEXT NOT NULL,
      username TEXT NULL,
      telegram_user_id TEXT PRIMARY KEY,
      telegram_username TEXT NULL,
      display_name TEXT NULL,
      first_seen_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_authorization (
      platform TEXT NOT NULL DEFAULT 'telegram',
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      username TEXT NULL,
      telegram_user_id TEXT PRIMARY KEY,
      telegram_chat_id TEXT NOT NULL,
      telegram_username TEXT NULL,
      display_name TEXT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_binding (
      platform TEXT NOT NULL DEFAULT 'telegram',
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      telegram_chat_id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      active_session_id TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session (
      session_id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      telegram_chat_id TEXT NOT NULL,
      thread_id TEXT NULL,
      selected_model TEXT NULL,
      selected_reasoning_effort TEXT NULL,
      plan_mode INTEGER NOT NULL DEFAULT 0,
      pending_default_collaboration_mode_reset INTEGER NOT NULL DEFAULT 0,
      display_name TEXT NOT NULL,
      display_name_source TEXT NOT NULL DEFAULT 'auto',
      project_name TEXT NOT NULL,
      project_path TEXT NOT NULL,
      status TEXT NOT NULL,
      failure_reason TEXT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      last_turn_id TEXT NULL,
      last_turn_status TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS recent_project (
      project_path TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      project_alias TEXT NULL,
      last_used_at TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      last_session_id TEXT NULL,
      last_success_at TEXT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_scan_cache (
      project_path TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      scan_root TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      detected_markers TEXT NOT NULL,
      last_scanned_at TEXT NOT NULL,
      exists_now INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bootstrap_state (
      key TEXT PRIMARY KEY,
      readiness_state TEXT NOT NULL,
      details_json TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      app_server_pid TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS runtime_notice (
      key TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      parse_mode TEXT NULL,
      reply_markup_json TEXT NULL,
      session_id TEXT NULL,
      turn_id TEXT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS final_answer_view (
      answer_id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      delivery_message_id INTEGER NULL,
      session_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'final_answer',
      delivery_state TEXT NOT NULL DEFAULT 'pending',
      preview_html TEXT NOT NULL,
      pages_json TEXT NOT NULL,
      primary_action_consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS current_session_card (
      chat_id TEXT PRIMARY KEY,
      message_id INTEGER NULL,
      session_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runtime_card_preferences (
      key TEXT PRIMARY KEY,
      fields_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bridge_settings (
      key TEXT PRIMARY KEY,
      ui_language TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS command_panel_preferences (
      chat_id TEXT PRIMARY KEY,
      commands_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_interaction (
      interaction_id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      request_id_canonical TEXT NOT NULL,
      request_id_legacy TEXT NULL,
      request_id_kind TEXT NOT NULL,
      request_method TEXT NOT NULL,
      interaction_kind TEXT NOT NULL,
      state TEXT NOT NULL,
      prompt_json TEXT NOT NULL,
      response_json TEXT NULL,
      message_id INTEGER NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT NULL,
      error_reason TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS turn_input_source (
      thread_id TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      transcript TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, turn_id)
    );

    CREATE INDEX IF NOT EXISTS idx_pending_authorization_last_seen
      ON pending_authorization(last_seen_at DESC);

    CREATE INDEX IF NOT EXISTS idx_session_chat_id
      ON session(telegram_chat_id);

    CREATE INDEX IF NOT EXISTS idx_final_answer_view_chat_created_at
      ON final_answer_view(chat_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_pending_interaction_chat_state
      ON pending_interaction(chat_id, state, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_pending_interaction_turn
      ON pending_interaction(thread_id, turn_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_turn_input_source_thread_created_at
      ON turn_input_source(thread_id, created_at DESC);
  `;
}

function listColumns(db: DatabaseSync, tableName: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function hasColumn(db: DatabaseSync, tableName: string, columnName: string): boolean {
  return listColumns(db, tableName).includes(columnName);
}

function getAppliedMigrations(db: DatabaseSync): Set<number> {
  const rows = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
    .all() as Array<{ version: number | bigint }>;

  return new Set(rows.map((row) => Number(row.version)));
}

function recordMigration(db: DatabaseSync, version: number): void {
  db.prepare(
    `
      INSERT OR REPLACE INTO schema_migrations (version, applied_at)
      VALUES (?, ?)
    `
  ).run(version, nowIso());
}

function applyMigrations(db: DatabaseSync): void {
  db.exec(
    `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `
  );

  const applied = getAppliedMigrations(db);

  if (!applied.has(1)) {
    db.exec(initialSchema());
    recordMigration(db, 1);
  }

  if (!applied.has(2)) {
    if (!hasColumn(db, "session", "archived")) {
      db.exec("ALTER TABLE session ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
    }

    if (!hasColumn(db, "session", "archived_at")) {
      db.exec("ALTER TABLE session ADD COLUMN archived_at TEXT NULL");
    }

    recordMigration(db, 2);
  }

  if (!applied.has(3)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS final_answer_view (
          answer_id TEXT PRIMARY KEY,
          telegram_chat_id TEXT NOT NULL,
          telegram_message_id INTEGER NULL,
          session_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'final_answer',
          delivery_state TEXT NOT NULL DEFAULT 'pending',
          preview_html TEXT NOT NULL,
          pages_json TEXT NOT NULL,
          primary_action_consumed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_final_answer_view_chat_created_at
          ON final_answer_view(telegram_chat_id, created_at DESC)
      `
    );

    recordMigration(db, 3);
  }

  if (!applied.has(4)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS pending_interaction (
          interaction_id TEXT PRIMARY KEY,
          telegram_chat_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          request_method TEXT NOT NULL,
          interaction_kind TEXT NOT NULL,
          state TEXT NOT NULL,
          prompt_json TEXT NOT NULL,
          response_json TEXT NULL,
          telegram_message_id INTEGER NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          resolved_at TEXT NULL,
          error_reason TEXT NULL
        )
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_chat_state
          ON pending_interaction(telegram_chat_id, state, created_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_turn
          ON pending_interaction(thread_id, turn_id, created_at DESC)
      `
    );

    recordMigration(db, 4);
  }

  if (!applied.has(5)) {
    if (!hasColumn(db, "session", "selected_model")) {
      db.exec("ALTER TABLE session ADD COLUMN selected_model TEXT NULL");
    }

    recordMigration(db, 5);
  }

  if (!applied.has(6)) {
    if (!hasColumn(db, "session", "selected_reasoning_effort")) {
      db.exec("ALTER TABLE session ADD COLUMN selected_reasoning_effort TEXT NULL");
    }

    recordMigration(db, 6);
  }

  if (!applied.has(7)) {
    if (!hasColumn(db, "recent_project", "project_alias")) {
      db.exec("ALTER TABLE recent_project ADD COLUMN project_alias TEXT NULL");
    }

    recordMigration(db, 7);
  }

  if (!applied.has(8)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS runtime_card_preferences (
          key TEXT PRIMARY KEY,
          fields_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `
    );

    db.exec(
      `
        CREATE TABLE IF NOT EXISTS turn_input_source (
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          source_kind TEXT NOT NULL,
          transcript TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (thread_id, turn_id)
        )
      `
    );

    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_turn_input_source_thread_created_at
          ON turn_input_source(thread_id, created_at DESC)
      `
    );

    recordMigration(db, 8);
  }

  if (!applied.has(9)) {
    if (appliedTableExists(db, "runtime_card_preferences")) {
      const rows = db
        .prepare(
          `
            SELECT key, fields_json, updated_at
            FROM runtime_card_preferences
          `
        )
        .all() as unknown as RuntimeCardPreferencesRecord[];

      const updatePreference = db.prepare(
        `
          UPDATE runtime_card_preferences
          SET fields_json = ?
          WHERE key = ?
        `
      );

      for (const row of rows) {
        if (!shouldMigrateRuntimeStatusFields(row.updated_at)) {
          continue;
        }

        const migrated = migrateRuntimeStatusFields(row.fields_json);
        if (!migrated) {
          continue;
        }

        updatePreference.run(JSON.stringify(migrated), row.key);
      }
    }

    recordMigration(db, 9);
  }

  if (!applied.has(10)) {
    if (!hasColumn(db, "session", "plan_mode")) {
      db.exec("ALTER TABLE session ADD COLUMN plan_mode INTEGER NOT NULL DEFAULT 0");
    }

    recordMigration(db, 10);
  }

  if (!applied.has(11)) {
    if (!hasColumn(db, "session", "pending_default_collaboration_mode_reset")) {
      db.exec(
        "ALTER TABLE session ADD COLUMN pending_default_collaboration_mode_reset INTEGER NOT NULL DEFAULT 0"
      );
    }

    recordMigration(db, 11);
  }

  if (!applied.has(12)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS bridge_settings (
          key TEXT PRIMARY KEY,
          ui_language TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `
    );

    recordMigration(db, 12);
  }

  if (!applied.has(13)) {
    if (!hasColumn(db, "final_answer_view", "primary_action_consumed")) {
      db.exec("ALTER TABLE final_answer_view ADD COLUMN primary_action_consumed INTEGER NOT NULL DEFAULT 0");
    }

    recordMigration(db, 13);
  }

  if (!applied.has(14)) {
    if (!hasColumn(db, "runtime_notice", "parse_mode")) {
      db.exec("ALTER TABLE runtime_notice ADD COLUMN parse_mode TEXT NULL");
    }
    if (!hasColumn(db, "runtime_notice", "reply_markup_json")) {
      db.exec("ALTER TABLE runtime_notice ADD COLUMN reply_markup_json TEXT NULL");
    }
    if (!hasColumn(db, "runtime_notice", "session_id")) {
      db.exec("ALTER TABLE runtime_notice ADD COLUMN session_id TEXT NULL");
    }
    if (!hasColumn(db, "runtime_notice", "turn_id")) {
      db.exec("ALTER TABLE runtime_notice ADD COLUMN turn_id TEXT NULL");
    }

    recordMigration(db, 14);
  }

  if (!applied.has(15)) {
    if (!hasColumn(db, "final_answer_view", "kind")) {
      db.exec("ALTER TABLE final_answer_view ADD COLUMN kind TEXT NOT NULL DEFAULT 'final_answer'");
    }
    if (!hasColumn(db, "final_answer_view", "delivery_state")) {
      db.exec("ALTER TABLE final_answer_view ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'pending'");
    }

    const finalAnswerMessageColumn = hasColumn(db, "final_answer_view", "telegram_message_id")
      ? "COALESCE(delivery_message_id, telegram_message_id)"
      : "delivery_message_id";
    db.exec(
      `
        UPDATE final_answer_view
        SET delivery_state = CASE
          WHEN ${finalAnswerMessageColumn} IS NOT NULL THEN 'visible'
          ELSE 'pending'
        END
        WHERE delivery_state NOT IN ('pending', 'visible', 'deferred_notice_visible')
           OR delivery_state IS NULL
      `
    );

    recordMigration(db, 15);
  }

  if (!applied.has(16)) {
    if (!hasColumn(db, "session", "display_name_source")) {
      db.exec("ALTER TABLE session ADD COLUMN display_name_source TEXT NOT NULL DEFAULT 'auto'");
    }

    // Legacy fork sessions used a generated "Fork: ..." title before the source column existed.
    db.exec(
      `
        UPDATE session
        SET display_name_source = CASE
          WHEN display_name = project_name THEN 'auto'
          WHEN display_name LIKE 'Fork: %' THEN 'auto'
          WHEN display_name = (
            SELECT recent_project.project_alias
            FROM recent_project
            WHERE recent_project.project_path = session.project_path
            LIMIT 1
          ) THEN 'auto'
          ELSE 'manual'
        END
      `
    );

    recordMigration(db, 16);
  }

  if (!applied.has(17)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS runtime_notice (
          key TEXT PRIMARY KEY,
          telegram_chat_id TEXT NOT NULL,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          parse_mode TEXT NULL,
          reply_markup_json TEXT NULL,
          session_id TEXT NULL,
          turn_id TEXT NULL,
          created_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS final_answer_view (
          answer_id TEXT PRIMARY KEY,
          telegram_chat_id TEXT NOT NULL,
          telegram_message_id INTEGER NULL,
          session_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'final_answer',
          delivery_state TEXT NOT NULL DEFAULT 'pending',
          preview_html TEXT NOT NULL,
          pages_json TEXT NOT NULL,
          primary_action_consumed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS current_session_card (
          chat_id TEXT PRIMARY KEY,
          telegram_chat_id TEXT NOT NULL,
          message_id INTEGER NULL,
          telegram_message_id INTEGER NULL,
          session_id TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS pending_interaction (
          interaction_id TEXT PRIMARY KEY,
          telegram_chat_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          request_method TEXT NOT NULL,
          interaction_kind TEXT NOT NULL,
          state TEXT NOT NULL,
          prompt_json TEXT NOT NULL,
          response_json TEXT NULL,
          telegram_message_id INTEGER NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          resolved_at TEXT NULL,
          error_reason TEXT NULL
        )
      `
    );

    if (!hasColumn(db, "runtime_notice", "chat_id")) {
      db.exec("ALTER TABLE runtime_notice ADD COLUMN chat_id TEXT NULL");
    }
    const runtimeNoticeChatSource = hasColumn(db, "runtime_notice", "telegram_chat_id")
      ? "COALESCE(chat_id, telegram_chat_id)"
      : "chat_id";
    db.exec(
      `
        UPDATE runtime_notice
        SET chat_id = ${runtimeNoticeChatSource}
        WHERE chat_id IS NULL
      `
    );

    if (!hasColumn(db, "final_answer_view", "chat_id")) {
      db.exec("ALTER TABLE final_answer_view ADD COLUMN chat_id TEXT NULL");
    }
    if (!hasColumn(db, "final_answer_view", "delivery_message_id")) {
      db.exec("ALTER TABLE final_answer_view ADD COLUMN delivery_message_id INTEGER NULL");
    }
    const finalAnswerChatSource = hasColumn(db, "final_answer_view", "telegram_chat_id")
      ? "COALESCE(chat_id, telegram_chat_id)"
      : "chat_id";
    const finalAnswerMessageSource = hasColumn(db, "final_answer_view", "telegram_message_id")
      ? "COALESCE(delivery_message_id, telegram_message_id)"
      : "delivery_message_id";
    db.exec(
      `
        UPDATE final_answer_view
        SET
          chat_id = ${finalAnswerChatSource},
          delivery_message_id = ${finalAnswerMessageSource}
        WHERE chat_id IS NULL OR delivery_message_id IS NULL
      `
    );

    if (!hasColumn(db, "current_session_card", "chat_id")) {
      db.exec("ALTER TABLE current_session_card ADD COLUMN chat_id TEXT NULL");
    }
    if (!hasColumn(db, "current_session_card", "message_id")) {
      db.exec("ALTER TABLE current_session_card ADD COLUMN message_id INTEGER NULL");
    }
    const currentCardChatSource = hasColumn(db, "current_session_card", "telegram_chat_id")
      ? "COALESCE(chat_id, telegram_chat_id)"
      : "chat_id";
    const currentCardMessageSource = hasColumn(db, "current_session_card", "telegram_message_id")
      ? "COALESCE(message_id, telegram_message_id)"
      : "message_id";
    db.exec(
      `
        UPDATE current_session_card
        SET
          chat_id = ${currentCardChatSource},
          message_id = ${currentCardMessageSource}
        WHERE chat_id IS NULL OR message_id IS NULL
      `
    );

    if (!hasColumn(db, "pending_interaction", "chat_id")) {
      db.exec("ALTER TABLE pending_interaction ADD COLUMN chat_id TEXT NULL");
    }
    if (!hasColumn(db, "pending_interaction", "message_id")) {
      db.exec("ALTER TABLE pending_interaction ADD COLUMN message_id INTEGER NULL");
    }
    const pendingInteractionChatSource = hasColumn(db, "pending_interaction", "telegram_chat_id")
      ? "COALESCE(chat_id, telegram_chat_id)"
      : "chat_id";
    const pendingInteractionMessageSource = hasColumn(db, "pending_interaction", "telegram_message_id")
      ? "COALESCE(message_id, telegram_message_id)"
      : "message_id";
    db.exec(
      `
        UPDATE pending_interaction
        SET
          chat_id = ${pendingInteractionChatSource},
          message_id = ${pendingInteractionMessageSource}
        WHERE chat_id IS NULL OR message_id IS NULL
      `
    );

    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_runtime_notice_chat_id_created_at
          ON runtime_notice(chat_id, created_at ASC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_final_answer_view_chat_id_created_at_v17
          ON final_answer_view(chat_id, created_at DESC)
      `
    );
    db.exec(
      `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_current_session_card_chat_id
          ON current_session_card(chat_id)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_chat_id_state_v17
          ON pending_interaction(chat_id, state, created_at DESC)
      `
    );

    recordMigration(db, 17);
  }

  if (!applied.has(18)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS authorized_user (
          platform TEXT NOT NULL DEFAULT 'telegram',
          user_id TEXT NOT NULL,
          username TEXT NULL,
          telegram_user_id TEXT PRIMARY KEY,
          telegram_username TEXT NULL,
          display_name TEXT NULL,
          first_seen_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS pending_authorization (
          platform TEXT NOT NULL DEFAULT 'telegram',
          user_id TEXT NOT NULL,
          chat_id TEXT NOT NULL,
          username TEXT NULL,
          telegram_user_id TEXT PRIMARY KEY,
          telegram_chat_id TEXT NOT NULL,
          telegram_username TEXT NULL,
          display_name TEXT NULL,
          first_seen_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS chat_binding (
          platform TEXT NOT NULL DEFAULT 'telegram',
          chat_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          telegram_chat_id TEXT PRIMARY KEY,
          telegram_user_id TEXT NOT NULL,
          active_session_id TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS session (
          session_id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          telegram_chat_id TEXT NOT NULL,
          thread_id TEXT NULL,
          selected_model TEXT NULL,
          selected_reasoning_effort TEXT NULL,
          plan_mode INTEGER NOT NULL DEFAULT 0,
          pending_default_collaboration_mode_reset INTEGER NOT NULL DEFAULT 0,
          display_name TEXT NOT NULL,
          display_name_source TEXT NOT NULL DEFAULT 'auto',
          project_name TEXT NOT NULL,
          project_path TEXT NOT NULL,
          status TEXT NOT NULL,
          failure_reason TEXT NULL,
          archived INTEGER NOT NULL DEFAULT 0,
          archived_at TEXT NULL,
          created_at TEXT NOT NULL,
          last_used_at TEXT NOT NULL,
          last_turn_id TEXT NULL,
          last_turn_status TEXT NULL
        )
      `
    );

    if (!hasColumn(db, "authorized_user", "platform")) {
      db.exec("ALTER TABLE authorized_user ADD COLUMN platform TEXT NOT NULL DEFAULT 'telegram'");
    }
    if (!hasColumn(db, "authorized_user", "user_id")) {
      db.exec("ALTER TABLE authorized_user ADD COLUMN user_id TEXT NULL");
    }
    if (!hasColumn(db, "authorized_user", "username")) {
      db.exec("ALTER TABLE authorized_user ADD COLUMN username TEXT NULL");
    }
    db.exec(
      `
        UPDATE authorized_user
        SET
          user_id = COALESCE(user_id, telegram_user_id),
          username = COALESCE(username, telegram_username)
        WHERE user_id IS NULL OR username IS NULL
      `
    );

    if (!hasColumn(db, "pending_authorization", "platform")) {
      db.exec("ALTER TABLE pending_authorization ADD COLUMN platform TEXT NOT NULL DEFAULT 'telegram'");
    }
    if (!hasColumn(db, "pending_authorization", "user_id")) {
      db.exec("ALTER TABLE pending_authorization ADD COLUMN user_id TEXT NULL");
    }
    if (!hasColumn(db, "pending_authorization", "chat_id")) {
      db.exec("ALTER TABLE pending_authorization ADD COLUMN chat_id TEXT NULL");
    }
    if (!hasColumn(db, "pending_authorization", "username")) {
      db.exec("ALTER TABLE pending_authorization ADD COLUMN username TEXT NULL");
    }
    db.exec(
      `
        UPDATE pending_authorization
        SET
          user_id = COALESCE(user_id, telegram_user_id),
          chat_id = COALESCE(chat_id, telegram_chat_id),
          username = COALESCE(username, telegram_username)
        WHERE user_id IS NULL OR chat_id IS NULL OR username IS NULL
      `
    );

    if (!hasColumn(db, "chat_binding", "platform")) {
      db.exec("ALTER TABLE chat_binding ADD COLUMN platform TEXT NOT NULL DEFAULT 'telegram'");
    }
    if (!hasColumn(db, "chat_binding", "chat_id")) {
      db.exec("ALTER TABLE chat_binding ADD COLUMN chat_id TEXT NULL");
    }
    if (!hasColumn(db, "chat_binding", "user_id")) {
      db.exec("ALTER TABLE chat_binding ADD COLUMN user_id TEXT NULL");
    }
    db.exec(
      `
        UPDATE chat_binding
        SET
          chat_id = COALESCE(chat_id, telegram_chat_id),
          user_id = COALESCE(user_id, telegram_user_id)
        WHERE chat_id IS NULL OR user_id IS NULL
      `
    );

    if (!hasColumn(db, "session", "chat_id")) {
      db.exec("ALTER TABLE session ADD COLUMN chat_id TEXT NULL");
    }
    db.exec(
      `
        UPDATE session
        SET chat_id = COALESCE(chat_id, telegram_chat_id)
        WHERE chat_id IS NULL
      `
    );

    db.exec(
      `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_binding_chat_id
          ON chat_binding(chat_id)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_chat_binding_user_id
          ON chat_binding(user_id)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_session_chat_id_v18
          ON session(chat_id)
      `
    );

    recordMigration(db, 18);
  }

  if (!applied.has(19)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS pending_interaction (
          interaction_id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          request_method TEXT NOT NULL,
          interaction_kind TEXT NOT NULL,
          state TEXT NOT NULL,
          prompt_json TEXT NOT NULL,
          response_json TEXT NULL,
          message_id INTEGER NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          resolved_at TEXT NULL,
          error_reason TEXT NULL
        )
      `
    );

    if (!hasColumn(db, "pending_interaction", "request_id_canonical")) {
      db.exec("ALTER TABLE pending_interaction ADD COLUMN request_id_canonical TEXT NULL");
    }
    if (!hasColumn(db, "pending_interaction", "request_id_legacy")) {
      db.exec("ALTER TABLE pending_interaction ADD COLUMN request_id_legacy TEXT NULL");
    }
    if (!hasColumn(db, "pending_interaction", "request_id_kind")) {
      db.exec("ALTER TABLE pending_interaction ADD COLUMN request_id_kind TEXT NULL");
    }

    db.exec(
      `
        UPDATE pending_interaction
        SET
          request_id_canonical = CASE
            WHEN json_valid(request_id) = 1
              AND json_type(request_id, '$') IN ('text', 'integer', 'real')
              THEN request_id
            ELSE json_quote(request_id)
          END,
          request_id_legacy = CASE
            WHEN json_valid(request_id) = 1 AND json_type(request_id, '$') = 'text'
              THEN json_extract(request_id, '$')
            WHEN json_valid(request_id) = 1 AND json_type(request_id, '$') IN ('integer', 'real')
              THEN NULL
            ELSE request_id
          END,
          request_id_kind = CASE
            WHEN json_valid(request_id) = 1 AND json_type(request_id, '$') = 'text'
              THEN 'string'
            WHEN json_valid(request_id) = 1 AND json_type(request_id, '$') IN ('integer', 'real')
              THEN 'number'
            ELSE 'string'
          END
        WHERE request_id_canonical IS NULL
           OR request_id_kind IS NULL
           OR (request_id_kind = 'string' AND request_id_legacy IS NULL)
      `
    );

    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_request_canonical_v19
          ON pending_interaction(thread_id, request_id_kind, request_id_canonical, state, created_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_request_legacy_v19
          ON pending_interaction(thread_id, request_id_kind, request_id_legacy, state, created_at DESC)
      `
    );

    recordMigration(db, 19);
  }

  if (!applied.has(20)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS runtime_notice (
          key TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          parse_mode TEXT NULL,
          reply_markup_json TEXT NULL,
          session_id TEXT NULL,
          turn_id TEXT NULL,
          created_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS final_answer_view (
          answer_id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          delivery_message_id INTEGER NULL,
          session_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'final_answer',
          delivery_state TEXT NOT NULL DEFAULT 'pending',
          preview_html TEXT NOT NULL,
          pages_json TEXT NOT NULL,
          primary_action_consumed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS current_session_card (
          chat_id TEXT PRIMARY KEY,
          message_id INTEGER NULL,
          session_id TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `
    );
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS pending_interaction (
          interaction_id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          request_id_canonical TEXT NOT NULL,
          request_id_legacy TEXT NULL,
          request_id_kind TEXT NOT NULL,
          request_method TEXT NOT NULL,
          interaction_kind TEXT NOT NULL,
          state TEXT NOT NULL,
          prompt_json TEXT NOT NULL,
          response_json TEXT NULL,
          message_id INTEGER NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          resolved_at TEXT NULL,
          error_reason TEXT NULL
        )
      `
    );

    if (hasColumn(db, "runtime_notice", "telegram_chat_id")) {
      db.exec(
        `
          CREATE TABLE runtime_notice_v20 (
            key TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            parse_mode TEXT NULL,
            reply_markup_json TEXT NULL,
            session_id TEXT NULL,
            turn_id TEXT NULL,
            created_at TEXT NOT NULL
          )
        `
      );
      db.exec(
        `
          INSERT INTO runtime_notice_v20 (
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
          SELECT
            key,
            COALESCE(chat_id, telegram_chat_id),
            type,
            message,
            parse_mode,
            reply_markup_json,
            session_id,
            turn_id,
            created_at
          FROM runtime_notice
        `
      );
      db.exec("DROP TABLE runtime_notice");
      db.exec("ALTER TABLE runtime_notice_v20 RENAME TO runtime_notice");
    }

    if (hasColumn(db, "final_answer_view", "telegram_chat_id") || hasColumn(db, "final_answer_view", "telegram_message_id")) {
      db.exec(
        `
          CREATE TABLE final_answer_view_v20 (
            answer_id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            delivery_message_id INTEGER NULL,
            session_id TEXT NOT NULL,
            thread_id TEXT NOT NULL,
            turn_id TEXT NOT NULL,
            kind TEXT NOT NULL DEFAULT 'final_answer',
            delivery_state TEXT NOT NULL DEFAULT 'pending',
            preview_html TEXT NOT NULL,
            pages_json TEXT NOT NULL,
            primary_action_consumed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
          )
        `
      );
      db.exec(
        `
          INSERT INTO final_answer_view_v20 (
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
          SELECT
            answer_id,
            COALESCE(chat_id, telegram_chat_id),
            COALESCE(delivery_message_id, telegram_message_id),
            session_id,
            thread_id,
            turn_id,
            kind,
            delivery_state,
            preview_html,
            pages_json,
            primary_action_consumed,
            created_at
          FROM final_answer_view
        `
      );
      db.exec("DROP TABLE final_answer_view");
      db.exec("ALTER TABLE final_answer_view_v20 RENAME TO final_answer_view");
    }

    if (hasColumn(db, "current_session_card", "telegram_chat_id") || hasColumn(db, "current_session_card", "telegram_message_id")) {
      db.exec(
        `
          CREATE TABLE current_session_card_v20 (
            chat_id TEXT PRIMARY KEY,
            message_id INTEGER NULL,
            session_id TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `
      );
      db.exec(
        `
          INSERT INTO current_session_card_v20 (
            chat_id,
            message_id,
            session_id,
            updated_at
          )
          SELECT
            COALESCE(chat_id, telegram_chat_id),
            COALESCE(message_id, telegram_message_id),
            session_id,
            updated_at
          FROM current_session_card
        `
      );
      db.exec("DROP TABLE current_session_card");
      db.exec("ALTER TABLE current_session_card_v20 RENAME TO current_session_card");
    }

    if (hasColumn(db, "pending_interaction", "telegram_chat_id") || hasColumn(db, "pending_interaction", "telegram_message_id")) {
      db.exec(
        `
          CREATE TABLE pending_interaction_v20 (
            interaction_id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            thread_id TEXT NOT NULL,
            turn_id TEXT NOT NULL,
            request_id TEXT NOT NULL,
            request_id_canonical TEXT NOT NULL,
            request_id_legacy TEXT NULL,
            request_id_kind TEXT NOT NULL,
            request_method TEXT NOT NULL,
            interaction_kind TEXT NOT NULL,
            state TEXT NOT NULL,
            prompt_json TEXT NOT NULL,
            response_json TEXT NULL,
            message_id INTEGER NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            resolved_at TEXT NULL,
            error_reason TEXT NULL
          )
        `
      );
      db.exec(
        `
          INSERT INTO pending_interaction_v20 (
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
          SELECT
            interaction_id,
            COALESCE(chat_id, telegram_chat_id),
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
            COALESCE(message_id, telegram_message_id),
            created_at,
            updated_at,
            resolved_at,
            error_reason
          FROM pending_interaction
        `
      );
      db.exec("DROP TABLE pending_interaction");
      db.exec("ALTER TABLE pending_interaction_v20 RENAME TO pending_interaction");
    }

    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_runtime_notice_chat_id_created_at
          ON runtime_notice(chat_id, created_at ASC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_final_answer_view_chat_created_at
          ON final_answer_view(chat_id, created_at DESC)
      `
    );
    db.exec(
      `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_current_session_card_chat_id
          ON current_session_card(chat_id)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_chat_state
          ON pending_interaction(chat_id, state, created_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_turn
          ON pending_interaction(thread_id, turn_id, created_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_request_canonical_v19
          ON pending_interaction(thread_id, request_id_kind, request_id_canonical, state, created_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_interaction_request_legacy_v19
          ON pending_interaction(thread_id, request_id_kind, request_id_legacy, state, created_at DESC)
      `
    );

    recordMigration(db, 20);
  }

  if (!applied.has(21)) {
    db.exec(
      `
        CREATE TABLE authorized_user_v21 (
          platform TEXT NOT NULL DEFAULT 'telegram',
          user_id TEXT NOT NULL,
          username TEXT NULL,
          telegram_user_id TEXT NOT NULL,
          telegram_username TEXT NULL,
          display_name TEXT NULL,
          first_seen_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (platform, user_id)
        )
      `
    );
    db.exec(
      `
        INSERT OR REPLACE INTO authorized_user_v21 (
          platform,
          user_id,
          username,
          telegram_user_id,
          telegram_username,
          display_name,
          first_seen_at,
          updated_at
        )
        SELECT
          COALESCE(platform, 'telegram'),
          COALESCE(user_id, telegram_user_id),
          COALESCE(username, telegram_username),
          COALESCE(telegram_user_id, user_id),
          telegram_username,
          display_name,
          first_seen_at,
          updated_at
        FROM authorized_user
        ORDER BY updated_at ASC, rowid ASC
      `
    );
    db.exec("DROP TABLE authorized_user");
    db.exec("ALTER TABLE authorized_user_v21 RENAME TO authorized_user");

    db.exec(
      `
        CREATE TABLE pending_authorization_v21 (
          platform TEXT NOT NULL DEFAULT 'telegram',
          user_id TEXT NOT NULL,
          chat_id TEXT NOT NULL,
          username TEXT NULL,
          telegram_user_id TEXT NOT NULL,
          telegram_chat_id TEXT NOT NULL,
          telegram_username TEXT NULL,
          display_name TEXT NULL,
          first_seen_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          PRIMARY KEY (platform, user_id)
        )
      `
    );
    db.exec(
      `
        INSERT OR REPLACE INTO pending_authorization_v21 (
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
        SELECT
          COALESCE(platform, 'telegram'),
          COALESCE(user_id, telegram_user_id),
          COALESCE(chat_id, telegram_chat_id),
          COALESCE(username, telegram_username),
          COALESCE(telegram_user_id, user_id),
          COALESCE(telegram_chat_id, chat_id),
          telegram_username,
          display_name,
          first_seen_at,
          last_seen_at
        FROM pending_authorization
        ORDER BY last_seen_at ASC, first_seen_at ASC, rowid ASC
      `
    );
    db.exec("DROP TABLE pending_authorization");
    db.exec("ALTER TABLE pending_authorization_v21 RENAME TO pending_authorization");

    db.exec(
      `
        CREATE TABLE chat_binding_v21 (
          platform TEXT NOT NULL DEFAULT 'telegram',
          chat_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          telegram_chat_id TEXT NOT NULL,
          telegram_user_id TEXT NOT NULL,
          active_session_id TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (platform, chat_id)
        )
      `
    );
    db.exec(
      `
        INSERT OR REPLACE INTO chat_binding_v21 (
          platform,
          chat_id,
          user_id,
          telegram_chat_id,
          telegram_user_id,
          active_session_id,
          created_at,
          updated_at
        )
        SELECT
          COALESCE(platform, 'telegram'),
          COALESCE(chat_id, telegram_chat_id),
          COALESCE(user_id, telegram_user_id),
          COALESCE(telegram_chat_id, chat_id),
          COALESCE(telegram_user_id, user_id),
          active_session_id,
          created_at,
          updated_at
        FROM chat_binding
        ORDER BY updated_at ASC, created_at ASC, rowid ASC
      `
    );
    db.exec("DROP TABLE chat_binding");
    db.exec("ALTER TABLE chat_binding_v21 RENAME TO chat_binding");

    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_authorized_user_updated_at
          ON authorized_user(updated_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_authorized_user_platform_updated_at
          ON authorized_user(platform, updated_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_authorization_last_seen
          ON pending_authorization(last_seen_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_pending_authorization_platform_last_seen
          ON pending_authorization(platform, last_seen_at DESC, first_seen_at DESC)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_chat_binding_user_id
          ON chat_binding(user_id)
      `
    );
    db.exec(
      `
        CREATE INDEX IF NOT EXISTS idx_chat_binding_platform_user_id
          ON chat_binding(platform, user_id, updated_at DESC, created_at DESC)
      `
    );

    recordMigration(db, 21);
  }

  if (!applied.has(22)) {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS command_panel_preferences (
          chat_id TEXT PRIMARY KEY,
          commands_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `
    );

    recordMigration(db, 22);
  }
}

export function openInitializedDatabase(dbPath: string): DatabaseSync {
  const db = withStateStoreFailureStage("open_db", () => new DatabaseSync(dbPath));
  withStateStoreFailureStage("initialize_schema", () => initializeDatabase(db));
  withStateStoreFailureStage("verify_integrity", () => verifyIntegrity(db));
  return db;
}

function initializeDatabase(db: DatabaseSync): void {
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  applyMigrations(db);

  const applied = getAppliedMigrations(db);
  if (!applied.has(CURRENT_SCHEMA_VERSION)) {
    throw new Error(`schema migrations incomplete; expected version ${CURRENT_SCHEMA_VERSION}`);
  }
}

export function appliedTableExists(db: DatabaseSync, tableName: string): boolean {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `
    )
    .get(tableName) as { name: string } | undefined;

  return Boolean(row?.name);
}

function verifyIntegrity(db: DatabaseSync): void {
  const result = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  if (result.integrity_check !== "ok") {
    throw new Error(`sqlite integrity check failed: ${result.integrity_check}`);
  }
}

function isCorruptionLikeError(error: unknown): boolean {
  const message = `${error}`.toLowerCase();
  return message.includes("sqlite integrity check failed")
    || message.includes("database disk image is malformed")
    || message.includes("file is not a database");
}

function isSchemaLikeError(error: unknown): boolean {
  const message = `${error}`.toLowerCase();
  return message.includes("schema migrations incomplete")
    || message.includes("malformed database schema")
    || message.includes("no such table")
    || message.includes("no such column")
    || message.includes("table ") && message.includes("already exists");
}

function recommendedActionForClassification(classification: StateStoreFailureClassification): string {
  switch (classification) {
    case "integrity_failure":
      return "Do not replace the database. Copy bridge.db for offline inspection, run integrity_check manually, and restore from a known-good backup if needed.";
    case "schema_failure":
      return "Do not replace the database. Inspect migration/state-store logs, verify the running binary version, and fix the schema issue before restarting.";
    case "transient_open_failure":
    default:
      return "Retry service start after checking for transient filesystem or locking issues. Do not rotate or delete the database.";
  }
}

function classifyStateStoreFailure(error: unknown): StateStoreFailureClassification {
  if (isSchemaLikeError(error)) {
    return "schema_failure";
  }

  if (isCorruptionLikeError(error)) {
    return "integrity_failure";
  }

  return "transient_open_failure";
}

export function getStateStoreFailureStage(error: unknown): StateStoreOpenStage {
  const stage = (error as { stateStoreOpenStage?: StateStoreOpenStage }).stateStoreOpenStage;
  return stage ?? "open_db";
}

export function withStateStoreFailureStage<T>(stage: StateStoreOpenStage, operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    (error as { stateStoreOpenStage?: StateStoreOpenStage }).stateStoreOpenStage = stage;
    throw error;
  }
}

export function buildStateStoreFailure(
  dbPath: string,
  stage: StateStoreOpenStage,
  error: unknown
): StateStoreFailureRecord {
  const classification = classifyStateStoreFailure(error);
  return {
    detectedAt: nowIso(),
    dbPath,
    stage,
    classification,
    error: `${error}`,
    recommendedAction: recommendedActionForClassification(classification)
  };
}

async function writeStateStoreFailure(paths: BridgePaths, failure: StateStoreFailureRecord): Promise<void> {
  await mkdir(dirname(paths.stateStoreFailurePath), { recursive: true });
  await writeFile(paths.stateStoreFailurePath, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
}

export async function persistStateStoreFailure(
  paths: BridgePaths,
  failure: StateStoreFailureRecord,
  logger: Logger
): Promise<void> {
  try {
    await writeStateStoreFailure(paths, failure);
  } catch (markerError) {
    await logger.warn("state store failure marker write failed", {
      dbPath: failure.dbPath,
      markerPath: paths.stateStoreFailurePath,
      error: `${markerError}`
    }).catch(() => {});
  }
}

export async function logStateStoreOpenFailure(
  logger: Logger,
  failure: StateStoreFailureRecord
): Promise<void> {
  await logger.error("state store open failed", { ...failure }).catch(() => {});
}

export async function clearStateStoreFailure(paths: BridgePaths): Promise<void> {
  try {
    await unlink(paths.stateStoreFailurePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function readStateStoreFailure(paths: BridgePaths): Promise<StateStoreFailureRecord | null> {
  try {
    const content = await readFile(paths.stateStoreFailurePath, "utf8");
    return JSON.parse(content) as StateStoreFailureRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
