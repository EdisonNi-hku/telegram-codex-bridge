import type {
  PlatformCapabilitySnapshot,
  PlatformSurfaceIntent,
  PlatformSurfaceOperationResult
} from "../core/interaction-model/surface.js";
import {
  createEditedSurfaceOperationResult,
  createFailedSurfaceOperationResult,
  createSentSurfaceOperationResult
} from "../core/interaction-model/surface.js";
import type { TelegramInlineKeyboardMarkup } from "./api.js";
import { isTelegramEditCommitted, type TelegramEditResult } from "../service/runtime-surface-state.js";

export const TELEGRAM_SURFACE_CAPABILITY_SNAPSHOT: PlatformCapabilitySnapshot = {
  supportsCallbacks: true,
  supportsEdits: true,
  supportsRichTextPreview: true,
  supportsLongFormPagination: true,
  supportsUploads: true
};

export async function executeTelegramHtmlSurfaceOperation(options: {
  intent: PlatformSurfaceIntent;
  chatId: string;
  html: string;
  replyMarkup?: TelegramInlineKeyboardMarkup | undefined;
  existingMessageId?: number | null | undefined;
  preferEdit?: boolean | undefined;
  capabilities?: PlatformCapabilitySnapshot | undefined;
  sendHtmlMessage: (
    chatId: string,
    html: string,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ) => Promise<{ message_id: number } | null>;
  editHtmlMessage?: (
    chatId: string,
    messageId: number,
    html: string,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ) => Promise<TelegramEditResult>;
}): Promise<PlatformSurfaceOperationResult> {
  const capabilities = options.capabilities ?? TELEGRAM_SURFACE_CAPABILITY_SNAPSHOT;
  const canAttemptEdit = Boolean(
    options.preferEdit
    && options.existingMessageId
    && options.existingMessageId > 0
    && options.editHtmlMessage
    && capabilities.supportsEdits
  );

  if (canAttemptEdit) {
    const editResult = await options.editHtmlMessage!(
      options.chatId,
      options.existingMessageId!,
      options.html,
      options.replyMarkup
    );
    if (isTelegramEditCommitted(editResult)) {
      return createEditedSurfaceOperationResult(options.intent, options.existingMessageId!);
    }
  }

  const sent = await options.sendHtmlMessage(options.chatId, options.html, options.replyMarkup);
  if (sent) {
    return createSentSurfaceOperationResult(options.intent, sent.message_id);
  }

  return createFailedSurfaceOperationResult(
    options.intent,
    canAttemptEdit ? "edit_failed" : "send_failed",
    options.existingMessageId ?? null
  );
}
