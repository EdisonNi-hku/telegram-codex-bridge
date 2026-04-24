import type {
  EgressDeleteResult,
  EgressEditResult,
  EgressMessageSendResult,
  EgressSendDocumentOptions,
  EgressSendMessageOptions,
  EgressSendPhotoOptions,
  PlatformEgressAdapter
} from "../contract.js";
import type { FeishuTelegramApiCompat } from "../../feishu/api.js";

export class FeishuEgressAdapter implements PlatformEgressAdapter {
  readonly kind = "bot_api" as const;

  constructor(private readonly api: FeishuTelegramApiCompat) {}

  async sendMessage(
    chatId: string,
    text: string,
    options?: EgressSendMessageOptions
  ): Promise<EgressMessageSendResult> {
    const sent = await this.api.sendMessage(chatId, text, {
      ...(options?.replyMarkup !== undefined ? { replyMarkup: options.replyMarkup as never } : {}),
      ...(options?.parseMode === "HTML" ? { parseMode: "HTML" as const } : {})
    });
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
    await this.api.editMessageText(chatId, messageId, text, {
      ...(options?.replyMarkup !== undefined ? { replyMarkup: options.replyMarkup as never } : {}),
      ...(options?.parseMode === "HTML" ? { parseMode: "HTML" as const } : {})
    });
    return { outcome: "edited" };
  }

  async deleteMessage(chatId: string, messageId: number): Promise<EgressDeleteResult> {
    const deleted = await this.api.deleteMessage(chatId, messageId);
    return { outcome: deleted ? "deleted" : "not_found" };
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.api.answerCallbackQuery(callbackQueryId, text);
  }

  async pinChatMessage(chatId: string, messageId: number): Promise<boolean> {
    return await this.api.pinChatMessage(chatId, messageId);
  }

  async unpinChatMessage(chatId: string, messageId: number): Promise<boolean> {
    return await this.api.unpinChatMessage(chatId, messageId);
  }
}
