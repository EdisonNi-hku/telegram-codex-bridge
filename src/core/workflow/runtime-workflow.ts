import type { InspectSnapshot } from "../../activity/types.js";
import { formatVisibleRuntimeState, selectStatusProgressText } from "../../service/runtime-surface-state.js";
import type { SessionPresentationContext } from "../domain/context.js";
import type {
  RuntimeStatusCardView,
  RuntimeStatusControlsView
} from "../interaction-model/runtime.js";

export function createRuntimeStatusCardView(options: {
  sessionId: string;
  context: SessionPresentationContext;
  language: RuntimeStatusCardView["language"];
  inspect: InspectSnapshot;
  optionalFieldLines?: string[];
  planExpanded: boolean;
  agentsExpanded: boolean;
  includeFooter?: boolean;
}): RuntimeStatusCardView {
  return {
    sessionId: options.sessionId,
    sessionName: options.context.sessionName ?? null,
    projectName: options.context.projectName ?? null,
    ...(options.language ? { language: options.language } : {}),
    state: formatVisibleRuntimeState(options.inspect),
    optionalFieldLines: options.optionalFieldLines ?? [],
    progressText: selectStatusProgressText(options.inspect, options.inspect.completedCommentary.at(-1) ?? null),
    blockedReason: options.inspect.threadBlockedReason,
    planEntries: options.inspect.planSnapshot,
    planExpanded: options.planExpanded,
    agentEntries: options.inspect.agentSnapshot,
    agentsExpanded: options.agentsExpanded,
    includeFooter: options.includeFooter ?? true
  };
}

export function createRuntimeStatusControlsView(options: {
  sessionId: string;
  language: RuntimeStatusControlsView["language"];
  inspect: InspectSnapshot;
  planExpanded: boolean;
  agentsExpanded: boolean;
}): RuntimeStatusControlsView {
  return {
    sessionId: options.sessionId,
    ...(options.language ? { language: options.language } : {}),
    planEntries: options.inspect.planSnapshot,
    planExpanded: options.planExpanded,
    agentEntries: options.inspect.agentSnapshot,
    agentsExpanded: options.agentsExpanded
  };
}
