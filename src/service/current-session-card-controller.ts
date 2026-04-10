import type { Logger } from "../logger.js";
import type { BridgeStateStore } from "../state/store.js";
import { buildCurrentSessionCardText } from "../telegram/ui.js";
import type { ReasoningEffort, SessionRow, UiLanguage } from "../types.js";
import {
  isTelegramDeleteCommitted,
  isTelegramEditCommitted,
  type TelegramDeleteResult,
  type TelegramEditResult
} from "./runtime-surface-state.js";

interface CurrentSessionCardControllerDeps {
  logger: Pick<Logger, "warn">;
  getStore: () => BridgeStateStore | null;
  getUiLanguage: () => UiLanguage;
  safeSendHtmlMessageResult: (chatId: string, html: string) => Promise<{ message_id: number } | null>;
  safeEditHtmlMessageText: (chatId: string, messageId: number, html: string) => Promise<TelegramEditResult>;
  safeDeleteMessage: (chatId: string, messageId: number) => Promise<TelegramDeleteResult>;
  safePinChatMessage: (chatId: string, messageId: number) => Promise<boolean>;
  safeUnpinChatMessage: (chatId: string, messageId: number) => Promise<boolean>;
  resolveSessionModelState: (session: SessionRow) => Promise<{
    configuredModel: string | null;
    configuredReasoningEffort: ReasoningEffort | null;
    effectiveModel: string | null;
    effectiveReasoningEffort: ReasoningEffort | null;
  }>;
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

    const modelState = await this.deps.resolveSessionModelState(activeSession);
    const html = buildCurrentSessionCardText(activeSession, this.deps.getUiLanguage(), modelState);
    let nextMessageId = existingMessageId;
    const shouldRecreate = this.shouldRecreateCard(existing?.sessionId ?? null, activeSession.sessionId, reason);

    if (existingMessageId && existingMessageId > 0 && !shouldRecreate) {
      const result = await this.deps.safeEditHtmlMessageText(chatId, existingMessageId, html);
      if (isTelegramEditCommitted(result)) {
        nextMessageId = existingMessageId;
      } else {
        const sent = await this.deps.safeSendHtmlMessageResult(chatId, html);
        nextMessageId = sent?.message_id ?? null;
      }
    } else {
      const sent = await this.deps.safeSendHtmlMessageResult(chatId, html);
      nextMessageId = sent?.message_id ?? null;
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
