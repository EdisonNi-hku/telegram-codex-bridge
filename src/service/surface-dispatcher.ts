import {
  createDeferredSurfaceOperationResult,
  createEditedSurfaceOperationResult,
  createFailedSurfaceOperationResult,
  createPlatformSurfaceCapabilityPolicy,
  createSentSurfaceOperationResult,
  type PlatformCapabilitySnapshot,
  type PlatformSurfaceControlRequirements,
  type PlatformSurfaceIntent,
  type PlatformSurfaceOperationResult
} from "../core/interaction-model/surface.js";
import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import type { EgressMessageSendResult } from "../packs/contract.js";
import { isTelegramEditCommitted, type EgressEditResult } from "./runtime-surface-state.js";

export interface DispatchHtmlSurfaceOptions {
  intent: PlatformSurfaceIntent;
  chatId: string;
  html: string;
  replyMarkup?: TelegramInlineKeyboardMarkup | undefined;
  existingMessageId?: number | null | undefined;
  preferEdit?: boolean | undefined;
  sendOnEditFailure?: boolean | undefined;
  deferredIntent?: PlatformSurfaceIntent | undefined;
  capabilities: PlatformCapabilitySnapshot;
  requirements?: PlatformSurfaceControlRequirements | undefined;
  sendHtmlMessage: (
    chatId: string,
    html: string,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ) => Promise<EgressMessageSendResult | null>;
  editHtmlMessage?: (
    chatId: string,
    messageId: number,
    html: string,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ) => Promise<EgressEditResult>;
}

export async function dispatchHtmlSurface(
  options: DispatchHtmlSurfaceOptions
): Promise<PlatformSurfaceOperationResult> {
  const policy = createPlatformSurfaceCapabilityPolicy(
    options.intent,
    options.capabilities,
    options.requirements
  );

  if (policy.shouldDefer && options.deferredIntent) {
    return createDeferredSurfaceOperationResult(
      options.intent,
      options.deferredIntent,
      options.existingMessageId ?? null
    );
  }
  if (policy.shouldDefer) {
    return createFailedSurfaceOperationResult(
      options.intent,
      "capability_blocked",
      options.existingMessageId ?? null
    );
  }

  const canAttemptEdit = Boolean(
    options.preferEdit
    && options.existingMessageId
    && options.existingMessageId > 0
    && options.editHtmlMessage
    && policy.canEditInPlace
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
    if (editResult.outcome === "rate_limited") {
      return createFailedSurfaceOperationResult(
        options.intent,
        "rate_limited",
        options.existingMessageId ?? null,
        editResult.retryAfterMs ?? undefined
      );
    }
    if (options.sendOnEditFailure === false) {
      return createFailedSurfaceOperationResult(
        options.intent,
        "edit_failed",
        options.existingMessageId ?? null
      );
    }
  }

  const sent = await options.sendHtmlMessage(options.chatId, options.html, options.replyMarkup);
  if (sent) {
    return createSentSurfaceOperationResult(options.intent, sent.messageId);
  }

  return createFailedSurfaceOperationResult(
    options.intent,
    canAttemptEdit ? "edit_failed" : "send_failed",
    options.existingMessageId ?? null
  );
}
