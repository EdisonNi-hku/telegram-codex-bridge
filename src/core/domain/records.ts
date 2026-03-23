import type {
  PendingInteractionState,
  TerminalDeliveryState,
  TerminalResultKind
} from "./common.js";

export interface PersistedInteractionRecord {
  interactionId: string;
  state: PendingInteractionState;
  responseJson: string | null;
  errorReason: string | null;
}

export interface PersistedTerminalResultRecord {
  answerId: string;
  kind: TerminalResultKind;
  deliveryState: TerminalDeliveryState;
  previewHtml: string;
  pages: string[];
  primaryActionConsumed: boolean;
}
