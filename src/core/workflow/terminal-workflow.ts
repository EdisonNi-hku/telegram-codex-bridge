import type { FinalAnswerViewRow } from "../../types.js";
import type { TerminalResultDeliveryView } from "../interaction-model/terminal.js";

type PersistedTerminalResult = Pick<
  FinalAnswerViewRow,
  "answerId" | "kind" | "previewHtml" | "pages" | "primaryActionConsumed"
>;

export function createTerminalResultDeliveryView(
  saved: PersistedTerminalResult,
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
  saved: PersistedTerminalResult
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
