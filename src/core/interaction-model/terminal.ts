import type { TerminalResultControlsRef, TerminalResultRef } from "../domain/context.js";

export interface TerminalResultControlView extends TerminalResultControlsRef {
  collapsible?: boolean;
  expanded: boolean;
  currentPage?: number;
}

export interface TerminalResultDeliveryView {
  kind: TerminalResultRef["kind"];
  html: string;
  controls: TerminalResultControlView;
}
