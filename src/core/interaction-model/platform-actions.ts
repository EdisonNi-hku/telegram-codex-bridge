import type { PlatformCapabilitySnapshot } from "./surface.js";

export type BridgePlatformAction = "send_control_surface_file";

export interface ControlSurfaceFileRequest {
  chatId: string;
  filePath: string;
  caption?: string | undefined;
  fileName?: string | undefined;
}

export interface ControlSurfaceFileDeliveryRef {
  messageId: number | null;
}

export type ControlSurfaceFileResult =
  | {
    action: BridgePlatformAction;
    outcome: "sent";
    deliveryRef: ControlSurfaceFileDeliveryRef;
  }
  | {
    action: BridgePlatformAction;
    outcome: "failed";
    reason: "capability_blocked" | "send_failed";
    deliveryRef: ControlSurfaceFileDeliveryRef;
  };

export async function dispatchControlSurfaceFileAction(options: {
  capabilities: PlatformCapabilitySnapshot;
  request: ControlSurfaceFileRequest;
  sendFile: (request: ControlSurfaceFileRequest) => Promise<ControlSurfaceFileDeliveryRef | null>;
}): Promise<ControlSurfaceFileResult> {
  if (!options.capabilities.supportsUploads) {
    return {
      action: "send_control_surface_file",
      outcome: "failed",
      reason: "capability_blocked",
      deliveryRef: { messageId: null }
    };
  }

  const deliveryRef = await options.sendFile(options.request);
  if (deliveryRef) {
    return {
      action: "send_control_surface_file",
      outcome: "sent",
      deliveryRef
    };
  }

  return {
    action: "send_control_surface_file",
    outcome: "failed",
    reason: "send_failed",
    deliveryRef: { messageId: null }
  };
}
