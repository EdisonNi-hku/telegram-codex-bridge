import type {
  EgressDeleteResult,
  EgressEditResult,
  EgressMessageSendResult,
  EgressSendDocumentOptions,
  EgressSendMessageOptions,
  EgressSendPhotoOptions,
  PlatformEgressAdapter
} from "../packs/contract.js";
import type { TelegramApi } from "./api.js";

export class TelegramEgressAdapter implements PlatformEgressAdapter {
  readonly kind = "bot_api" as const;

  constructor(private readonly api: TelegramApi) {}

  async sendMessage(
    chatId: string,
    text: string,
    options?: EgressSendMessageOptions
  ): Promise<EgressMessageSendResult> {
    const opts: Record<string, unknown> = {};
    if (options?.parseMode === "HTML") {
      opts.parseMode = "HTML";
    }
    if (options?.replyMarkup !== undefined) {
      opts.replyMarkup = options.replyMarkup;
    }
    const sent = await this.api.sendMessage(chatId, text, Object.keys(opts).length > 0 ? opts : undefined);
    return { messageId: sent.message_id };
  }

  async sendPhoto(
    chatId: string,
    photoPath: string,
    options?: EgressSendPhotoOptions
  ): Promise<EgressMessageSendResult> {
    const sent = await this.api.sendPhoto(chatId, photoPath, options);
    return { messageId: sent.message_id };
  }

  async sendDocument(
    chatId: string,
    filePath: string,
    options?: EgressSendDocumentOptions
  ): Promise<EgressMessageSendResult> {
    const sent = await this.api.sendDocument(chatId, filePath, options);
    return { messageId: sent.message_id };
  }

  async editMessageText(
    chatId: string,
    messageId: number,
    text: string,
    options?: EgressSendMessageOptions
  ): Promise<EgressEditResult> {
    const opts: Record<string, unknown> = {};
    if (options?.parseMode === "HTML") {
      opts.parseMode = "HTML";
    }
    if (options?.replyMarkup !== undefined) {
      opts.replyMarkup = options.replyMarkup;
    }
    await this.api.editMessageText(
      chatId,
      messageId,
      text,
      Object.keys(opts).length > 0 ? opts : undefined
    );
    return { outcome: "edited" };
  }

  async deleteMessage(chatId: string, messageId: number): Promise<EgressDeleteResult> {
    await this.api.deleteMessage(chatId, messageId);
    return { outcome: "deleted" };
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.api.answerCallbackQuery(callbackQueryId, text);
  }

  async pinChatMessage(chatId: string, messageId: number): Promise<boolean> {
    return await this.api.pinChatMessage(chatId, messageId, { disableNotification: true });
  }

  async unpinChatMessage(chatId: string, messageId: number): Promise<boolean> {
    return await this.api.unpinChatMessage(chatId, messageId);
  }
}
