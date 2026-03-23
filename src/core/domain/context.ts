import type { TerminalResultKind } from "./common.js";

export interface SessionDisplayContext {
  sessionName?: string | null;
  projectName?: string | null;
}

export interface SessionPresentationContext extends SessionDisplayContext {
  sessionId: string;
}

export interface InteractionRef {
  interactionId: string;
}

export interface TerminalResultControlsRef {
  answerId: string;
  totalPages: number;
  primaryActionConsumed?: boolean;
}

export interface TerminalResultRef extends TerminalResultControlsRef {
  kind: TerminalResultKind;
}
