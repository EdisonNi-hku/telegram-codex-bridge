import type { SessionDisplayContext, TerminalResultControlsRef, TerminalResultRef } from "../domain/context.js";

export interface TerminalResultControlView extends TerminalResultControlsRef {
  collapsible?: boolean;
  expanded: boolean;
  currentPage?: number;
}

export interface RecentOutputEntryView extends SessionDisplayContext {
  hasResult: boolean;
}

export interface TerminalResultDeliveryView {
  kind: TerminalResultRef["kind"];
  html: string;
  controls: TerminalResultControlView;
}
