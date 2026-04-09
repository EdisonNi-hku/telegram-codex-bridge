import type {
  PlatformCapabilitySnapshot,
  PlatformSurfaceIntent,
  PlatformSurfaceOperationResult
} from "../core/interaction-model/surface.js";
import {
  type PlatformSurfaceControlRequirements
} from "../core/interaction-model/surface.js";
import type { TelegramInlineKeyboardMarkup } from "./api.js";
import type { TelegramEditResult } from "../service/runtime-surface-state.js";
import { dispatchHtmlSurface } from "../service/surface-dispatcher.js";

export const TELEGRAM_SURFACE_CAPABILITY_SNAPSHOT: PlatformCapabilitySnapshot = {
  supportsCallbacks: true,
  supportsEdits: true,
  supportsRichTextPreview: true,
  supportsLongFormPagination: true,
  supportsUploads: true,
  canSendImage: true,
  canSendFile: true,
  canReceiveImage: true,
  canReceiveFile: true,
  canReceiveVoice: true,
  canUseRemoteImageUrl: false
};

export async function executeTelegramHtmlSurfaceOperation(options: {
  intent: PlatformSurfaceIntent;
  chatId: string;
  html: string;
  replyMarkup?: TelegramInlineKeyboardMarkup | undefined;
  existingMessageId?: number | null | undefined;
  preferEdit?: boolean | undefined;
  deferredIntent?: PlatformSurfaceIntent | undefined;
  capabilities?: PlatformCapabilitySnapshot | undefined;
  requirements?: PlatformSurfaceControlRequirements | undefined;
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
  return await dispatchHtmlSurface({
    intent: options.intent,
    chatId: options.chatId,
    html: options.html,
    replyMarkup: options.replyMarkup,
    existingMessageId: options.existingMessageId,
    preferEdit: options.preferEdit,
    deferredIntent: options.deferredIntent,
    capabilities,
    requirements: options.requirements ?? {
      requiresCallbacks: Boolean(options.replyMarkup)
    },
    sendHtmlMessage: options.sendHtmlMessage,
    ...(options.editHtmlMessage ? { editHtmlMessage: options.editHtmlMessage } : {})
  });
}
