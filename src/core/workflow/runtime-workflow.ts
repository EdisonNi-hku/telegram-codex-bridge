import type { InspectSnapshot } from "../../activity/types.js";
import type { SessionPresentationContext } from "../domain/context.js";
import type {
  RollbackConfirmView,
  RollbackPickerView,
  RuntimeInspectControlsView,
  RuntimeInspectView,
  RuntimePreferencesView,
  RuntimeStatusCardView,
  RuntimeStatusControlsView
} from "../interaction-model/runtime.js";

export function formatVisibleRuntimeState(status: InspectSnapshot): string {
  if (status.latestProgress && /^Reconnecting/i.test(status.latestProgress)) {
    return "Reconnecting";
  }

  switch (status.turnStatus) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "interrupted":
      return "Interrupted";
    default:
      break;
  }

  if (status.threadBlockedReason || status.turnStatus === "blocked") {
    return "Blocked";
  }

  if (status.threadRuntimeState === "systemError") {
    return "Failed";
  }

  if (status.threadRuntimeState === "active") {
    return "Running";
  }

  switch (status.turnStatus) {
    case "starting":
      return "Starting";
    case "running":
      return "Running";
    case "idle":
      return "Idle";
    default:
      return "Unknown";
  }
}

export function formatRuntimeBlockedReason(reason: InspectSnapshot["threadBlockedReason"]): string | null {
  switch (reason) {
    case "waitingOnApproval":
      return "approval";
    case "waitingOnUserInput":
      return "user input";
    default:
      return null;
  }
}

export function selectStatusProgressText(status: InspectSnapshot, latestProgressUnit: string | null): string | null {
  if (latestProgressUnit) {
    return latestProgressUnit;
  }

  if (status.latestProgress && /^Reconnecting/i.test(status.latestProgress)) {
    return status.latestProgress;
  }

  if (status.turnStatus === "failed") {
    return null;
  }

  if (status.latestProgress) {
    return status.latestProgress;
  }

  if (status.lastHighValueEventType === "found" && status.lastHighValueDetail) {
    return status.lastHighValueDetail;
  }

  return null;
}

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

export function createRuntimePreferencesView(options: RuntimePreferencesView): RuntimePreferencesView {
  return {
    token: options.token,
    fields: [...options.fields],
    page: options.page
  };
}

export function createRuntimeInspectView(options: RuntimeInspectView): RuntimeInspectView {
  return {
    sessionId: options.sessionId,
    ...(options.sessionName !== undefined ? { sessionName: options.sessionName } : {}),
    ...(options.projectName !== undefined ? { projectName: options.projectName } : {}),
    html: options.html
  };
}

export function createRuntimeInspectControlsView(
  options: RuntimeInspectControlsView
): RuntimeInspectControlsView {
  return {
    sessionId: options.sessionId,
    page: options.page,
    collapsed: options.collapsed
  };
}

export function createRollbackPickerView(options: RollbackPickerView): RollbackPickerView {
  return {
    sessionId: options.sessionId,
    page: options.page,
    targets: [...options.targets]
  };
}

export function createRollbackConfirmView(options: RollbackConfirmView): RollbackConfirmView {
  return {
    sessionId: options.sessionId,
    page: options.page,
    target: options.target
  };
}
