export interface PlatformCapabilitySnapshot {
  supportsCallbacks: boolean;
  supportsEdits: boolean;
  supportsRichTextPreview: boolean;
  supportsLongFormPagination: boolean;
  supportsUploads: boolean;
  canSendImage: boolean;
  canSendFile: boolean;
  canReceiveImage: boolean;
  canReceiveFile: boolean;
  canReceiveVoice: boolean;
  canUseRemoteImageUrl: boolean;
}

export type PlatformSurfaceIntent =
  | "runtime_hub"
  | "runtime_status"
  | "runtime_inspect"
  | "runtime_preferences"
  | "runtime_rollback"
  | "runtime_recent_output"
  | "pending_interaction"
  | "terminal_result"
  | "terminal_result_deferred_notice";

export type PlatformSurfaceCategory = "runtime" | "interaction" | "terminal";

export interface PlatformSurfaceCapabilityPolicy {
  intent: PlatformSurfaceIntent;
  category: PlatformSurfaceCategory;
  canUseCallbacks: boolean;
  canEditInPlace: boolean;
  canRenderRichPreview: boolean;
  canPaginateLongForm: boolean;
  canUploadFiles: boolean;
  shouldDefer: boolean;
  deferReason: "missing_callbacks" | "missing_rich_preview" | "missing_long_form_pagination" | null;
}

export interface PlatformSurfaceControlRequirements {
  requiresCallbacks?: boolean;
  requiresRichTextPreview?: boolean;
  requiresLongFormPagination?: boolean;
  requiresUploads?: boolean;
}

export interface PlatformSurfaceDeliveryRef {
  messageId: number | null;
}

export type PlatformSurfaceOperationResult =
  | {
    intent: PlatformSurfaceIntent;
    outcome: "sent";
    deliveryRef: { messageId: number };
  }
  | {
    intent: PlatformSurfaceIntent;
    outcome: "edited";
    deliveryRef: { messageId: number };
  }
  | {
    intent: PlatformSurfaceIntent;
    outcome: "deferred";
    deferredIntent: PlatformSurfaceIntent;
    deliveryRef: PlatformSurfaceDeliveryRef;
  }
  | {
    intent: PlatformSurfaceIntent;
    outcome: "failed";
    reason: "send_failed" | "edit_failed" | "rate_limited" | "capability_blocked";
    deliveryRef: PlatformSurfaceDeliveryRef;
    retryAfterMs?: number;
  };

export function createSentSurfaceOperationResult(
  intent: PlatformSurfaceIntent,
  messageId: number
): PlatformSurfaceOperationResult {
  return {
    intent,
    outcome: "sent",
    deliveryRef: { messageId }
  };
}

export function createEditedSurfaceOperationResult(
  intent: PlatformSurfaceIntent,
  messageId: number
): PlatformSurfaceOperationResult {
  return {
    intent,
    outcome: "edited",
    deliveryRef: { messageId }
  };
}

export function createDeferredSurfaceOperationResult(
  intent: PlatformSurfaceIntent,
  deferredIntent: PlatformSurfaceIntent,
  messageId: number | null
): PlatformSurfaceOperationResult {
  return {
    intent,
    outcome: "deferred",
    deferredIntent,
    deliveryRef: { messageId }
  };
}

export function createFailedSurfaceOperationResult(
  intent: PlatformSurfaceIntent,
  reason: "send_failed" | "edit_failed" | "rate_limited" | "capability_blocked",
  messageId: number | null = null,
  retryAfterMs?: number
): PlatformSurfaceOperationResult {
  return {
    intent,
    outcome: "failed",
    reason,
    deliveryRef: { messageId },
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {})
  };
}

export function isVisibleSurfaceOperationResult(result: PlatformSurfaceOperationResult): boolean {
  return result.outcome === "sent" || result.outcome === "edited" || result.outcome === "deferred";
}

export function getPlatformSurfaceCategory(intent: PlatformSurfaceIntent): PlatformSurfaceCategory {
  switch (intent) {
    case "pending_interaction":
      return "interaction";
    case "terminal_result":
    case "terminal_result_deferred_notice":
      return "terminal";
    default:
      return "runtime";
  }
}

export function createPlatformSurfaceCapabilityPolicy(
  intent: PlatformSurfaceIntent,
  capabilities: PlatformCapabilitySnapshot,
  requirements?: PlatformSurfaceControlRequirements
): PlatformSurfaceCapabilityPolicy {
  const requiresCallbacks = requirements?.requiresCallbacks ?? false;
  const requiresRichTextPreview = requirements?.requiresRichTextPreview ?? false;
  const requiresLongFormPagination = requirements?.requiresLongFormPagination ?? false;
  const requiresUploads = requirements?.requiresUploads ?? false;
  const missingCallbacks = requiresCallbacks && !capabilities.supportsCallbacks;
  const missingRichPreview = requiresRichTextPreview && !capabilities.supportsRichTextPreview;
  const missingPagination = requiresLongFormPagination && !capabilities.supportsLongFormPagination;

  return {
    intent,
    category: getPlatformSurfaceCategory(intent),
    canUseCallbacks: !missingCallbacks,
    canEditInPlace: capabilities.supportsEdits,
    canRenderRichPreview: !missingRichPreview,
    canPaginateLongForm: !missingPagination,
    canUploadFiles: !requiresUploads || capabilities.supportsUploads,
    shouldDefer: missingCallbacks || missingRichPreview || missingPagination,
    deferReason: missingCallbacks
      ? "missing_callbacks"
      : missingRichPreview
        ? "missing_rich_preview"
        : missingPagination
          ? "missing_long_form_pagination"
          : null
  };
}
