import type { CollabAgentStateSnapshot } from "../../activity/types.js";
import type { RuntimeStatusField, UiLanguage } from "../../types.js";
import type { SessionDisplayContext, SessionPresentationContext } from "../domain/context.js";

export interface RuntimeCommandEntryView {
  commandText: string;
  state: string;
  latestSummary?: string | null;
  cwd?: string | null;
  exitCode?: number | null;
  durationMs?: number | null;
}

export interface RuntimeStatusFieldOptionView {
  field: RuntimeStatusField;
  label: string;
  selected: boolean;
}

export interface RuntimePreferencesView {
  token: string;
  fields: RuntimeStatusField[];
  page: number;
}

export interface RuntimeInspectView extends SessionDisplayContext {
  sessionId: string;
  html: string;
}

export interface RuntimeInspectControlsView {
  sessionId: string;
  page: number;
  collapsed: boolean;
}

export interface RollbackTargetView {
  index: number;
  sequenceNumber: number;
  label: string;
  rollbackCount: number;
}

export interface RollbackPickerView {
  sessionId: string;
  page: number;
  targets: RollbackTargetView[];
}

export interface RollbackConfirmView {
  sessionId: string;
  page: number;
  target: RollbackTargetView;
}

export interface RuntimeStatusCardView extends SessionDisplayContext {
  sessionId?: string;
  language?: UiLanguage;
  state: string;
  statusLine?: string | null;
  optionalFieldLines?: string[];
  progressText?: string | null;
  blockedReason?: string | null;
  planEntries?: string[];
  planExpanded?: boolean;
  agentEntries?: CollabAgentStateSnapshot[];
  agentsExpanded?: boolean;
  progressTextLimit?: number;
  expandedPlanEntryLimit?: number;
  expandedPlanEntryTextLimit?: number;
  expandedAgentLimit?: number;
  expandedAgentProgressTextLimit?: number;
  includeFooter?: boolean;
}

export interface RuntimeStatusControlsView {
  sessionId: string;
  language?: UiLanguage;
  planEntries: string[];
  planExpanded: boolean;
  agentEntries: CollabAgentStateSnapshot[];
  agentsExpanded: boolean;
}

export interface RuntimeHubSessionView extends SessionPresentationContext {
  sessionName: string;
  projectName?: string | null;
  state: string;
  progressText?: string | null;
  slot?: number | null;
  isFocused: boolean;
  isActiveInputTarget: boolean;
}

export interface RuntimeHubTerminalSummaryView extends SessionDisplayContext {
  sessionName: string;
  state: string;
}

export interface RuntimeHubView {
  language?: UiLanguage;
  windowIndex: number;
  totalWindows: number;
  totalSessions?: number;
  sessions?: RuntimeHubSessionView[];
  activeInputSession?: RuntimeHubSessionView | null;
  sessionCollectionKind?: "running" | "generic";
  planEntries?: string[];
  planExpanded?: boolean;
  agentEntries?: CollabAgentStateSnapshot[];
  agentsExpanded?: boolean;
  terminalSummaries?: RuntimeHubTerminalSummaryView[];
  currentViewedSession?: RuntimeHubSessionView | null;
  otherSessions?: RuntimeHubSessionView[];
  recentEndedSessions?: RuntimeHubSessionView[];
  isMainHub?: boolean;
  completed?: boolean;
  sessionProgressTextLimit?: number;
  currentViewedSessionProgressTextLimit?: number;
  otherSessionProgressTextLimit?: number;
  recentEndedSessionProgressTextLimit?: number;
  genericSessionLayout?: "detailed" | "compact";
  genericVisibleSessionLimit?: number;
  hubPlanEntryLimit?: number;
  hubPlanEntryTextLimit?: number;
  hubAgentEntryLimit?: number;
  hubAgentProgressTextLimit?: number;
  reminderText?: string | null;
}
