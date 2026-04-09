import type { PlatformCapabilitySnapshot } from "./surface.js";

export type BridgePlatformAction = "send_control_surface_file" | "send_control_surface_image";

export interface ControlSurfaceFileRequest {
  chatId: string;
  filePath: string;
  caption?: string | undefined;
  fileName?: string | undefined;
}

export interface ControlSurfaceImageRequest {
  chatId: string;
  imagePath: string;
  caption?: string | undefined;
}

export interface ControlSurfaceFileDeliveryRef {
  messageId: number | null;
}

export interface ControlSurfaceImageDeliveryRef {
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

export type ControlSurfaceImageResult =
  | {
    action: BridgePlatformAction;
    outcome: "sent";
    deliveryRef: ControlSurfaceImageDeliveryRef;
  }
  | {
    action: BridgePlatformAction;
    outcome: "failed";
    reason: "capability_blocked" | "send_failed";
    deliveryRef: ControlSurfaceImageDeliveryRef;
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

export async function dispatchControlSurfaceImageAction(options: {
  capabilities: PlatformCapabilitySnapshot;
  request: ControlSurfaceImageRequest;
  sendImage: (request: ControlSurfaceImageRequest) => Promise<ControlSurfaceImageDeliveryRef | null>;
}): Promise<ControlSurfaceImageResult> {
  if (!options.capabilities.canSendImage) {
    return {
      action: "send_control_surface_image",
      outcome: "failed",
      reason: "capability_blocked",
      deliveryRef: { messageId: null }
    };
  }

  const deliveryRef = await options.sendImage(options.request);
  if (deliveryRef) {
    return {
      action: "send_control_surface_image",
      outcome: "sent",
      deliveryRef
    };
  }

  return {
    action: "send_control_surface_image",
    outcome: "failed",
    reason: "send_failed",
    deliveryRef: { messageId: null }
  };
}
