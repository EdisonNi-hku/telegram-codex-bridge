import type { PersistedTerminalResultRecord } from "../domain/records.js";
import type {
  RecentOutputEntryView,
  TerminalResultControlView,
  TerminalResultDeliveryView
} from "../interaction-model/terminal.js";

export function createTerminalResultDeliveryView(
  saved: PersistedTerminalResultRecord,
  truncated: boolean
): TerminalResultDeliveryView {
  return {
    kind: saved.kind,
    html: truncated || saved.pages.length > 1
      ? saved.previewHtml
      : (saved.pages[0] ?? saved.previewHtml),
    controls: {
      answerId: saved.answerId,
      totalPages: saved.pages.length,
      collapsible: truncated || saved.pages.length > 1,
      expanded: false,
      primaryActionConsumed: saved.primaryActionConsumed
    }
  };
}

export function createDeferredTerminalNoticeView(
  saved: PersistedTerminalResultRecord
): TerminalResultDeliveryView {
  if (saved.kind === "plan_result") {
    return {
      kind: "plan_result",
      html: "<i>方案结果暂未送达。点击“展开方案”重新渲染。</i>",
      controls: {
        answerId: saved.answerId,
        totalPages: saved.pages.length,
        collapsible: true,
        expanded: false,
        primaryActionConsumed: saved.primaryActionConsumed
      }
    };
  }

  return {
    kind: "final_answer",
    html: "<i>最终答复暂未送达。点击“展开全文”重新渲染。</i>",
    controls: {
      answerId: saved.answerId,
      totalPages: saved.pages.length,
      collapsible: true,
      expanded: false,
      primaryActionConsumed: saved.primaryActionConsumed
    }
  };
}

export function createRecentOutputEntryView(options: RecentOutputEntryView): RecentOutputEntryView {
  return {
    ...(options.sessionName !== undefined ? { sessionName: options.sessionName } : {}),
    ...(options.projectName !== undefined ? { projectName: options.projectName } : {}),
    hasResult: options.hasResult
  };
}

export function createRecentOutputControlsView(
  saved: PersistedTerminalResultRecord,
  options?: {
    expanded?: boolean;
    currentPage?: number;
  }
): TerminalResultControlView {
  return {
    answerId: saved.answerId,
    totalPages: saved.pages.length,
    collapsible: true,
    expanded: options?.expanded ?? false,
    ...(options?.currentPage !== undefined ? { currentPage: options.currentPage } : {}),
    primaryActionConsumed: saved.primaryActionConsumed
  };
}
