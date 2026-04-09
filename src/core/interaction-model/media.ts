export type BridgeMediaKind = "image" | "file" | "audio";

export type BridgeMediaRole = "user_input" | "control_surface_attachment" | "preview";

export type BridgeMediaSource = "platform_resource" | "local_path" | "remote_url";

export type BridgeMediaStatus = "resolved" | "unresolved";

export interface PlatformResourceRef {
  platform: "telegram" | "feishu";
  conversationId: string;
  messageId: string;
  resourceId: string;
  resourceType: string;
}

export interface BridgeMediaDescriptor {
  kind: BridgeMediaKind;
  role: BridgeMediaRole;
  source: BridgeMediaSource;
  mimeType?: string | undefined;
  filename?: string | undefined;
  sizeBytes?: number | undefined;
  caption?: string | undefined;
  platformRef?: PlatformResourceRef | undefined;
}

export interface ResolvedMediaAsset {
  descriptor: BridgeMediaDescriptor;
  status: BridgeMediaStatus;
  localPath: string | null;
  sha256: string | null;
  resolvedAt: string | null;
  expiresAt: string | null;
  failureReason?: string | undefined;
}

export interface InboundUserMediaEvent {
  text: string | null;
  media: ResolvedMediaAsset[];
}
