import type { Logger } from "../logger.js";
import type { BridgeStateStore } from "../state/store.js";
import type { SessionRow } from "../types.js";
import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import type { EgressMessageSendResult } from "../packs/contract.js";
import {
  isTelegramDeleteCommitted,
  isTelegramEditCommitted,
  type EgressDeleteResult,
  type EgressEditResult
} from "./runtime-surface-state.js";

interface CurrentSessionCardControllerDeps {
  logger: Pick<Logger, "warn">;
  getStore: () => BridgeStateStore | null;
  renderSessionCard: (session: SessionRow) => Promise<{ html: string; replyMarkup?: TelegramInlineKeyboardMarkup }>;
  safeSendHtmlMessageResult: (chatId: string, html: string, replyMarkup?: TelegramInlineKeyboardMarkup) => Promise<EgressMessageSendResult | null>;
  safeEditHtmlMessageText: (chatId: string, messageId: number, html: string, replyMarkup?: TelegramInlineKeyboardMarkup) => Promise<EgressEditResult>;
  safeDeleteMessage: (chatId: string, messageId: number) => Promise<EgressDeleteResult>;
  safePinChatMessage: (chatId: string, messageId: number) => Promise<boolean>;
  safeUnpinChatMessage: (chatId: string, messageId: number) => Promise<boolean>;
}

export class CurrentSessionCardController {
  constructor(private readonly deps: CurrentSessionCardControllerDeps) {}

  async syncForChat(chatId: string, reason: string): Promise<void> {
    const store = this.deps.getStore();
    if (!store) {
      return;
    }

    const activeSession = store.getActiveSession(chatId);
    const existing = store.getCurrentSessionCard(chatId);
    const existingMessageId = existing?.messageId ?? null;

    if (!activeSession) {
      if (existingMessageId && existingMessageId > 0) {
        await this.deps.safeUnpinChatMessage(chatId, existingMessageId);
        await this.deps.safeDeleteMessage(chatId, existingMessageId);
      }
      store.deleteCurrentSessionCard(chatId);
      return;
    }

    const { html, replyMarkup } = await this.deps.renderSessionCard(activeSession);
    let nextMessageId = existingMessageId;
    const shouldRecreate = this.shouldRecreateCard(existing?.sessionId ?? null, activeSession.sessionId, reason);

    if (existingMessageId && existingMessageId > 0 && !shouldRecreate) {
      const result = await this.deps.safeEditHtmlMessageText(chatId, existingMessageId, html, replyMarkup);
      if (isTelegramEditCommitted(result)) {
        nextMessageId = existingMessageId;
      } else {
        const sent = await this.deps.safeSendHtmlMessageResult(chatId, html, replyMarkup);
        nextMessageId = sent?.messageId ?? null;
      }
    } else {
      const sent = await this.deps.safeSendHtmlMessageResult(chatId, html, replyMarkup);
      nextMessageId = sent?.messageId ?? null;
    }

    if (!nextMessageId || nextMessageId <= 0) {
      await this.deps.logger.warn("current session card sync failed to deliver", { chatId, reason });
      return;
    }

    store.upsertCurrentSessionCard({
      chatId,
      messageId: nextMessageId,
      sessionId: activeSession.sessionId
    });

    await this.deps.safePinChatMessage(chatId, nextMessageId);

    if (existingMessageId && existingMessageId > 0 && existingMessageId !== nextMessageId) {
      await this.deps.safeUnpinChatMessage(chatId, existingMessageId);
      await this.deps.safeDeleteMessage(chatId, existingMessageId);
    }
  }

  private shouldRecreateCard(
    existingSessionId: string | null,
    activeSessionId: string,
    reason: string
  ): boolean {
    if (reason === "startup_restore") {
      return true;
    }

    return existingSessionId !== null && existingSessionId !== activeSessionId;
  }
}
