export interface PlatformCapabilitySnapshot {
  supportsCallbacks: boolean;
  supportsEdits: boolean;
  supportsRichTextPreview: boolean;
  supportsLongFormPagination: boolean;
  supportsUploads: boolean;
}

export type PlatformSurfaceIntent =
  | "pending_interaction"
  | "terminal_result"
  | "terminal_result_deferred_notice";

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
    reason: "send_failed" | "edit_failed";
    deliveryRef: PlatformSurfaceDeliveryRef;
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
  reason: "send_failed" | "edit_failed",
  messageId: number | null = null
): PlatformSurfaceOperationResult {
  return {
    intent,
    outcome: "failed",
    reason,
    deliveryRef: { messageId }
  };
}

export function isVisibleSurfaceOperationResult(result: PlatformSurfaceOperationResult): boolean {
  return result.outcome === "sent" || result.outcome === "edited" || result.outcome === "deferred";
}
