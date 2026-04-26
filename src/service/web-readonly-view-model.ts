import { createHash } from "node:crypto";

export type WebReadonlyAvailability = "available" | "unavailable" | "degraded";
export type WebReadonlyCatalogState = WebReadonlyAvailability | "empty";
export type WebReadonlyObservedState = "present" | "missing" | "unknown";

export interface WebReadonlyOperatorBinding {
  chatId: string;
}

export interface WebReadonlyRecentProjectRow {
  projectPath: string;
  projectName: string;
  projectAlias?: string | null;
  lastUsedAt: string;
  pinned?: boolean;
  lastSessionId?: string | null;
  lastSuccessAt?: string | null;
  source?: string;
}

export interface WebReadonlySessionProjectStatsRow {
  projectPath: string;
  projectName: string;
  sessionCount: number;
  lastUsedAt: string | null;
}

export interface WebReadonlySessionRow {
  sessionId: string;
  chatId?: string;
  telegramChatId?: string;
  threadId?: string | null;
  displayName: string;
  projectName: string;
  projectAlias?: string | null;
  projectPath: string;
  status: string;
  failureReason?: string | null;
  archived?: boolean;
  createdAt: string;
  lastUsedAt: string;
  lastTurnId?: string | null;
  lastTurnStatus?: string | null;
}

export interface WebReadonlyFinalAnswerRow {
  answerId: string;
  chatId?: string;
  deliveryMessageId?: number | null;
  sessionId: string;
  threadId?: string;
  turnId?: string;
  kind: string;
  deliveryState: string;
  previewHtml?: string;
  pages?: string[];
  primaryActionConsumed?: boolean;
  createdAt: string;
}

export interface WebReadonlyReadinessSnapshot {
  state: string;
  checkedAt: string;
  details: {
    activePack?: string;
    codexInstalled?: boolean;
    codexAuthenticated?: boolean;
    appServerAvailable?: boolean;
    authorizedUserBound?: boolean;
    issues?: string[];
    [key: string]: unknown;
  };
  appServerPid?: string | null;
}

export interface WebReadonlyActiveTurn {
  sessionId: string;
  status: string;
  summary?: string | null;
  blockedReason?: string | null;
  [key: string]: unknown;
}

export interface WebReadonlyPendingInteractionInputRow {
  id?: string | number | null;
  interactionId?: string | number | null;
  pendingInteractionId?: string | number | null;
  conversationId?: string | number | null;
  sessionId?: string | number | null;
  status?: string | null;
  state?: string | null;
  kind?: string | null;
  type?: string | null;
  category?: string | null;
  summary?: string | null;
  blockingReason?: string | null;
  blockedReason?: string | null;
  reason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface WebReadonlyArtifactDescriptorInputRow {
  id?: string | number | null;
  artifactId?: string | number | null;
  finalResultId?: string | number | null;
  label?: string | null;
  title?: string | null;
  name?: string | null;
  filename?: string | null;
  kind?: string | null;
  type?: string | null;
  mediaType?: string | null;
  mimeType?: string | null;
  sizeBytes?: string | number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  availability?: string | null;
  previewEligible?: boolean | null;
  downloadEligible?: boolean | null;
  [key: string]: unknown;
}

export interface WebReadonlyStoreReader {
  listRecentProjects?: () => WebReadonlyRecentProjectRow[];
  listSessionProjectStats?: () => WebReadonlySessionProjectStatsRow[];
  listSessions?: (chatId: string, options?: { archived?: boolean; limit?: number }) => WebReadonlySessionRow[];
  getSessionById?: (sessionId: string) => WebReadonlySessionRow | null;
  listFinalAnswerViews?: (chatId: string) => WebReadonlyFinalAnswerRow[];
  getReadinessSnapshot?: () => WebReadonlyReadinessSnapshot | null;
}

export interface WebReadonlyViewModelDeps {
  store?: WebReadonlyStoreReader;
  operatorBinding?: WebReadonlyOperatorBinding | null;
  now?: () => string;
  idSalt?: string;
  listActiveTurns?: () => WebReadonlyActiveTurn[] | null | undefined;
  listPendingInteractions?: () => WebReadonlyPendingInteractionInputRow[] | null | undefined;
  listArtifactDescriptors?: (sessionId: string) => WebReadonlyArtifactDescriptorInputRow[] | null | undefined;
  getReadinessSnapshot?: () => WebReadonlyReadinessSnapshot | null | undefined;
  getSanitizedFinalAnswerBody?: (answer: WebReadonlyFinalAnswerRow) => string | null | undefined;
}

export interface WebReadonlyEnvelope {
  generatedAt: string;
  prototypeOnly: true;
  readonly: true;
}

export interface WebReadonlyWorkspaceRow {
  workspaceId: string;
  label: string;
  availability: WebReadonlyAvailability;
  conversationCount: number;
  pinned: boolean;
  lastActivityAt: string | null;
  lastSuccessAt: string | null;
  source: string;
}

export interface WebReadonlyWorkspaceListViewModel extends WebReadonlyEnvelope {
  pageId: "web_workspaces";
  state: WebReadonlyAvailability;
  workspaces: WebReadonlyWorkspaceRow[];
  warnings: string[];
}

export interface WebReadonlyConversationRow {
  conversationId: string;
  conversationHandle: string;
  workspaceId: string;
  title: string;
  status: string;
  failureReason: string | null;
  archived: boolean;
  createdAt: string;
  lastActivityAt: string;
  lastTurnStatus: string | null;
  finalAnswerAvailable: boolean;
}

export interface WebReadonlyWorkspaceConversationListViewModel extends WebReadonlyEnvelope {
  pageId: "web_workspace_conversations";
  state: WebReadonlyAvailability;
  workspaceId: string;
  conversations: WebReadonlyConversationRow[];
  emptyState: string | null;
  warnings: string[];
}

export interface WebReadonlyAnswerBodyUnavailable {
  state: "unavailable";
  reason: "sanitized_body_not_provided" | "unsafe_final_answer_body";
}

export interface WebReadonlyAnswerBodyAvailable {
  state: "available";
  text: string;
}

export interface WebReadonlyAnswerRow {
  answerId: string;
  kind: string;
  deliveryState: string;
  createdAt: string;
  body: WebReadonlyAnswerBodyUnavailable | WebReadonlyAnswerBodyAvailable;
  summary: string;
}

export interface WebReadonlyConversationResultViewModel extends WebReadonlyEnvelope {
  pageId: "web_conversation_result";
  state: WebReadonlyAvailability;
  conversation: {
    conversationId: string;
    conversationHandle: string;
    workspaceId: string;
    title: string;
    workspaceLabel: string;
    status: string;
    failureReason: string | null;
    archived: boolean;
    createdAt: string;
    lastActivityAt: string;
  } | null;
  answers: WebReadonlyAnswerRow[];
  runtime: Pick<WebReadonlyRuntimeContextViewModel, "state" | "activeTurns">;
  pendingInteractions: Pick<WebReadonlyPendingInteractionsViewModel, "state" | "pendingInteractions">;
  readiness: Pick<WebReadonlyReadinessGuardrailViewModel, "state" | "missingGates">;
  composer: WebReadonlyDisabledComposerViewModel;
  warnings: string[];
}

export interface WebReadonlyArtifactDescriptorRow {
  artifactId: string;
  label: string;
  kind: string;
  type: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  availability: WebReadonlyAvailability;
  previewEligible: boolean;
  previewLabel: string;
  downloadEligible: boolean;
  downloadLabel: string;
  warnings: string[];
}

export interface WebReadonlyConversationArtifactCatalogViewModel extends WebReadonlyEnvelope {
  pageId: "web_conversation_artifacts";
  state: WebReadonlyCatalogState;
  conversationId: string;
  artifacts: WebReadonlyArtifactDescriptorRow[];
  selectedArtifact: WebReadonlyArtifactDescriptorRow | null;
  emptyState: string | null;
  warnings: string[];
}

export interface WebReadonlyRuntimeTurnRow {
  sessionId: string;
  status: string;
  summary: string | null;
  blockedReason: string | null;
}

export interface WebReadonlyRuntimeContextViewModel extends WebReadonlyEnvelope {
  pageId: "web_runtime_context";
  state: WebReadonlyAvailability;
  activeTurns: WebReadonlyRuntimeTurnRow[];
  warnings: string[];
}

export interface WebReadonlyPendingInteractionSummaryUnavailable {
  state: "unavailable";
  reason: "pending_interaction_summary_not_provided" | "unsafe_pending_interaction_summary";
}

export interface WebReadonlyPendingInteractionSummaryAvailable {
  state: "available";
  text: string;
}

export interface WebReadonlyPendingInteractionViewRow {
  interactionId: string;
  conversationId: string | null;
  sessionId: string | null;
  status: string;
  kind: string;
  createdAt: string | null;
  updatedAt: string | null;
  blockingReason: string;
  summary: WebReadonlyPendingInteractionSummaryUnavailable | WebReadonlyPendingInteractionSummaryAvailable;
  availability: WebReadonlyAvailability;
  warnings: string[];
}

export interface WebReadonlyPendingInteractionsViewModel extends WebReadonlyEnvelope {
  pageId: "web_pending_interactions";
  state: WebReadonlyAvailability;
  pendingInteractions: WebReadonlyPendingInteractionViewRow[];
  warnings: string[];
}

export interface WebReadonlyReadinessCapabilityRow {
  key: string;
  label: string;
  declared: WebReadonlyObservedState;
  configured: WebReadonlyObservedState;
  observed: WebReadonlyObservedState;
  uxExposed: WebReadonlyObservedState;
}

export interface WebReadonlyReadinessGuardrailViewModel extends WebReadonlyEnvelope {
  pageId: "web_readiness_guardrails";
  state: string;
  checkedAt: string | null;
  activePack: string | null;
  capabilities: WebReadonlyReadinessCapabilityRow[];
  missingGates: string[];
  warnings: string[];
}

export interface WebReadonlyHomeViewModel extends WebReadonlyEnvelope {
  pageId: "web_home";
  state: WebReadonlyAvailability;
  operator: { binding: WebReadonlyAvailability };
  workspaces: WebReadonlyWorkspaceRow[];
  recentConversations: WebReadonlyConversationRow[];
  runtime: Pick<WebReadonlyRuntimeContextViewModel, "state" | "activeTurns">;
  pendingInteractions: Pick<WebReadonlyPendingInteractionsViewModel, "state" | "pendingInteractions">;
  readiness: Pick<WebReadonlyReadinessGuardrailViewModel, "state" | "missingGates">;
  composer: WebReadonlyDisabledComposerViewModel;
  warnings: string[];
}

export interface WebReadonlyDisabledComposerViewModel {
  state: "disabled";
  label: string;
  placeholder: string;
  disabledReason: string;
  capability: "web_send_landing_next";
}

export interface WebReadonlyViewModelProvider {
  getHomeViewModel(): WebReadonlyHomeViewModel;
  listWorkspaceViewModels(): WebReadonlyWorkspaceListViewModel;
  listWorkspaceConversationViewModels(workspaceId: string): WebReadonlyWorkspaceConversationListViewModel;
  getConversationResultViewModel(conversationHandle: string): WebReadonlyConversationResultViewModel;
  getConversationArtifactCatalogViewModel(sessionId: string, artifactId?: string): WebReadonlyConversationArtifactCatalogViewModel;
  getRuntimeContextViewModel(): WebReadonlyRuntimeContextViewModel;
  getPendingInteractionsViewModel(): WebReadonlyPendingInteractionsViewModel;
  getReadinessGuardrailViewModel(): WebReadonlyReadinessGuardrailViewModel;
}

interface WorkspaceAccumulator {
  path: string;
  label: string | null;
  projectName: string;
  pinned: boolean;
  conversationCount: number;
  lastActivityAt: string | null;
  lastSuccessAt: string | null;
  source: string;
}

const DEFAULT_ID_SALT = "web-readonly-view-model:v1";

export function createWebReadonlyViewModelProvider(deps: WebReadonlyViewModelDeps): WebReadonlyViewModelProvider {
  const now = () => deps.now?.() ?? new Date().toISOString();
  const idSalt = deps.idSalt ?? DEFAULT_ID_SALT;

  const envelope = (): WebReadonlyEnvelope => ({
    generatedAt: now(),
    prototypeOnly: true,
    readonly: true
  });

  const workspaceIdForPath = (projectPath: string): string => `wk_${hashOpaque(idSalt, projectPath)}`;
  const conversationHandleForSessionId = (sessionId: string): string => `cv_${hashOpaque(idSalt, sessionId)}`;

  const buildWorkspaceIndex = (): { state: WebReadonlyAvailability; rows: WorkspaceAccumulator[]; warnings: string[] } => {
    const store = deps.store;
    const chatId = deps.operatorBinding?.chatId;
    const canListScopedSessions = Boolean(chatId && store?.listSessions);
    if (!store || (!store.listRecentProjects && !store.listSessionProjectStats && !canListScopedSessions)) {
      return { state: "unavailable", rows: [], warnings: ["workspace_data_unavailable"] };
    }

    const warnings: string[] = [];
    const byPath = new Map<string, WorkspaceAccumulator>();

    const upsert = (projectPath: string, projectName: string, patch: Partial<WorkspaceAccumulator>): void => {
      const current = byPath.get(projectPath) ?? {
        path: projectPath,
        label: null,
        projectName: safeLabel(projectName, "Workspace"),
        pinned: false,
        conversationCount: 0,
        lastActivityAt: null,
        lastSuccessAt: null,
        source: "unknown"
      };
      const nextLastActivity = latestIso(current.lastActivityAt, patch.lastActivityAt ?? null);
      byPath.set(projectPath, {
        ...current,
        ...patch,
        label: safeOptionalLabel(patch.label === undefined ? current.label : patch.label),
        projectName: safeLabel(patch.projectName ?? current.projectName, "Workspace"),
        pinned: Boolean(current.pinned || patch.pinned),
        conversationCount: Math.max(current.conversationCount, patch.conversationCount ?? 0),
        lastActivityAt: nextLastActivity,
        lastSuccessAt: latestIso(current.lastSuccessAt, patch.lastSuccessAt ?? null),
        source: patch.source ?? current.source
      });
    };

    for (const project of callSafely(store.listRecentProjects, [], warnings, "recent_projects_unavailable")) {
      upsert(project.projectPath, project.projectName, {
        label: project.projectAlias ?? null,
        projectName: project.projectName,
        pinned: Boolean(project.pinned),
        lastActivityAt: project.lastUsedAt,
        lastSuccessAt: project.lastSuccessAt ?? null,
        source: project.source ?? "recent"
      });
    }

    for (const stat of callSafely(store.listSessionProjectStats, [], warnings, "workspace_stats_unavailable")) {
      upsert(stat.projectPath, stat.projectName, {
        projectName: stat.projectName,
        conversationCount: stat.sessionCount,
        lastActivityAt: stat.lastUsedAt,
        source: "session_stats"
      });
    }

    if (chatId && store.listSessions) {
      const bySessionPath = new Map<
        string,
        { projectName: string; label: string | null; conversationCount: number; lastActivityAt: string | null }
      >();
      const sessions = callSafely(
        () => store.listSessions?.(chatId, { archived: false, limit: 100 }) ?? [],
        [],
        warnings,
        "sessions_unavailable"
      );
      for (const session of sessions) {
        if (session.archived || !session.projectPath) {
          continue;
        }
        const current = bySessionPath.get(session.projectPath) ?? {
          projectName: session.projectName,
          label: null,
          conversationCount: 0,
          lastActivityAt: null
        };
        bySessionPath.set(session.projectPath, {
          projectName: session.projectName || current.projectName,
          label: session.projectAlias ?? current.label,
          conversationCount: current.conversationCount + 1,
          lastActivityAt: latestIso(current.lastActivityAt, session.lastUsedAt)
        });
      }

      for (const [projectPath, stat] of bySessionPath) {
        upsert(projectPath, stat.projectName, {
          label: stat.label,
          projectName: stat.projectName,
          conversationCount: stat.conversationCount,
          lastActivityAt: stat.lastActivityAt,
          source: "sessions"
        });
      }
    }

    return {
      state: warnings.length > 0 ? "degraded" : "available",
      rows: Array.from(byPath.values()).sort(compareWorkspaceRows),
      warnings
    };
  };

  const getFinalAnswerSessionSet = (): Set<string> => {
    const chatId = deps.operatorBinding?.chatId;
    if (!chatId || !deps.store?.listFinalAnswerViews) {
      return new Set();
    }
    return new Set(callSafely(() => deps.store?.listFinalAnswerViews?.(chatId) ?? [], [], [], "").map((answer) => answer.sessionId));
  };

  const listBoundSessions = (warnings: string[], archived = false): WebReadonlySessionRow[] | null => {
    const chatId = deps.operatorBinding?.chatId;
    if (!chatId || !deps.store?.listSessions) {
      return null;
    }
    return callSafely(() => deps.store?.listSessions?.(chatId, { archived, limit: 100 }) ?? [], [], warnings, "sessions_unavailable")
      .filter((session) => Boolean(session.archived) === archived);
  };

  const listBoundSessionsForDetail = (warnings: string[]): WebReadonlySessionRow[] | null => {
    const active = listBoundSessions(warnings, false);
    if (!active) {
      return null;
    }
    const archived = listBoundSessions(warnings, true) ?? [];
    return [...active, ...archived];
  };

  const toWorkspaceRow = (row: WorkspaceAccumulator): WebReadonlyWorkspaceRow => {
    const workspaceId = workspaceIdForPath(row.path);
    return {
      workspaceId,
      label: safeWorkspaceLabel(workspaceId, row.label),
      availability: "available",
      conversationCount: row.conversationCount,
      pinned: row.pinned,
      lastActivityAt: row.lastActivityAt,
      lastSuccessAt: row.lastSuccessAt,
      source: row.source
    };
  };

  const toConversationRow = (
    session: WebReadonlySessionRow,
    finalAnswerSessionIds: Set<string>
  ): WebReadonlyConversationRow => {
    const conversationHandle = conversationHandleForSessionId(session.sessionId);
    return {
      conversationId: conversationHandle,
      conversationHandle,
      workspaceId: workspaceIdForPath(session.projectPath),
      title: safeLabel(session.displayName, "Untitled conversation"),
      status: safeLabel(session.status, "unknown"),
      failureReason: session.failureReason ? safeLabel(session.failureReason, "failed") : null,
      archived: Boolean(session.archived),
      createdAt: session.createdAt,
      lastActivityAt: session.lastUsedAt,
      lastTurnStatus: session.lastTurnStatus ? safeLabel(session.lastTurnStatus, "unknown") : null,
      finalAnswerAvailable: finalAnswerSessionIds.has(session.sessionId)
    };
  };

  const provider: WebReadonlyViewModelProvider = {
    getHomeViewModel() {
      const workspaceVm = provider.listWorkspaceViewModels();
      const firstWorkspaceId = workspaceVm.workspaces[0]?.workspaceId;
      const conversationsVm = firstWorkspaceId
        ? provider.listWorkspaceConversationViewModels(firstWorkspaceId)
        : null;
      const runtime = provider.getRuntimeContextViewModel();
      const pendingInteractions = provider.getPendingInteractionsViewModel();
      const readiness = provider.getReadinessGuardrailViewModel();
      const warnings = [
        ...workspaceVm.warnings,
        ...(conversationsVm?.warnings ?? []),
        ...runtime.warnings,
        ...readiness.warnings
      ];

      return {
        ...envelope(),
        pageId: "web_home",
        state: workspaceVm.state === "available" ? "available" : "degraded",
        operator: { binding: deps.operatorBinding?.chatId ? "available" : "unavailable" },
        workspaces: workspaceVm.workspaces.slice(0, 5),
        recentConversations: conversationsVm?.conversations.slice(0, 5) ?? [],
        runtime: { state: runtime.state, activeTurns: runtime.activeTurns },
        pendingInteractions: {
          state: pendingInteractions.state,
          pendingInteractions: pendingInteractions.pendingInteractions
        },
        readiness: { state: readiness.state, missingGates: readiness.missingGates },
        composer: disabledComposerViewModel(),
        warnings: unique(warnings)
      };
    },

    listWorkspaceViewModels() {
      const index = buildWorkspaceIndex();
      return {
        ...envelope(),
        pageId: "web_workspaces",
        state: index.state,
        workspaces: index.rows.map(toWorkspaceRow),
        warnings: index.warnings
      };
    },

    listWorkspaceConversationViewModels(workspaceId) {
      const warnings: string[] = [];
      const sessions = listBoundSessions(warnings);
      if (!sessions) {
        return {
          ...envelope(),
          pageId: "web_workspace_conversations",
          state: "unavailable",
          workspaceId,
          conversations: [],
          emptyState: "session_data_unavailable",
          warnings: unique(["operator_binding_or_session_data_unavailable", ...warnings])
        };
      }

      const finalAnswerSessionIds = getFinalAnswerSessionSet();
      const conversations = sessions
        .filter((session) => workspaceIdForPath(session.projectPath) === workspaceId)
        .map((session) => toConversationRow(session, finalAnswerSessionIds));

      return {
        ...envelope(),
        pageId: "web_workspace_conversations",
        state: warnings.length > 0 ? "degraded" : "available",
        workspaceId,
        conversations,
        emptyState: conversations.length === 0 ? "no_conversations" : null,
        warnings: unique(warnings)
      };
    },

    getConversationResultViewModel(conversationHandle) {
      const requestedConversationHandle = conversationHandle.trim();
      const chatId = deps.operatorBinding?.chatId;
      if (!chatId || !deps.store?.listSessions || !isSafeConversationHandle(requestedConversationHandle)) {
        return unavailableConversationResult(envelope(), "conversation_data_unavailable");
      }

      const warnings: string[] = [];
      const sessions = listBoundSessionsForDetail(warnings);
      const session = sessions?.find((row) => conversationHandleForSessionId(row.sessionId) === requestedConversationHandle) ?? null;
      if (!session) {
        return unavailableConversationResult(envelope(), "conversation_not_available");
      }
      const safeConversationHandle = conversationHandleForSessionId(session.sessionId);

      const answers = callSafely(() => deps.store?.listFinalAnswerViews?.(chatId) ?? [], [], warnings, "final_answers_unavailable")
        .filter((answer) => answer.sessionId === session.sessionId)
        .map((answer): WebReadonlyAnswerRow => {
          const safeBody = sanitizeFinalAnswerBody(deps.getSanitizedFinalAnswerBody?.(answer));
          return {
            answerId: answer.answerId,
            kind: safeLabel(answer.kind, "final_answer"),
            deliveryState: safeLabel(answer.deliveryState, "unknown"),
            createdAt: answer.createdAt,
            body: safeBody.state === "available"
              ? { state: "available", text: safeBody.text }
              : { state: "unavailable", reason: safeBody.reason },
            summary: finalAnswerSummary(safeBody)
          };
        });

      return {
        ...envelope(),
        pageId: "web_conversation_result",
        state: warnings.length > 0 ? "degraded" : "available",
        conversation: {
          conversationId: safeConversationHandle,
          conversationHandle: safeConversationHandle,
          workspaceId: workspaceIdForPath(session.projectPath),
          title: safeLabel(session.displayName, "Untitled conversation"),
          workspaceLabel: safeWorkspaceLabel(workspaceIdForPath(session.projectPath), session.projectAlias ?? null),
          status: safeLabel(session.status, "unknown"),
          failureReason: session.failureReason ? safeLabel(session.failureReason, "failed") : null,
          archived: Boolean(session.archived),
          createdAt: session.createdAt,
          lastActivityAt: session.lastUsedAt
        },
        answers,
        runtime: runtimePanelForConversation(provider.getRuntimeContextViewModel(), safeConversationHandle),
        pendingInteractions: pendingPanelForConversation(provider.getPendingInteractionsViewModel(), safeConversationHandle),
        readiness: readinessPanel(provider.getReadinessGuardrailViewModel()),
        composer: disabledComposerViewModel(),
        warnings: unique(warnings)
      };
    },

    getConversationArtifactCatalogViewModel(sessionId, artifactId) {
      if (!deps.listArtifactDescriptors) {
        return unavailableArtifactCatalog(envelope(), sessionId, "artifact_catalog_unavailable");
      }

      const warnings: string[] = [];
      const rawRows = callSafely(
        () => deps.listArtifactDescriptors?.(sessionId) ?? null,
        null as WebReadonlyArtifactDescriptorInputRow[] | null,
        warnings,
        "artifact_catalog_degraded"
      );
      if (!rawRows) {
        return {
          ...envelope(),
          pageId: "web_conversation_artifacts",
          state: warnings.length > 0 ? "degraded" : "unavailable",
          conversationId: safeArtifactConversationId(sessionId),
          artifacts: [],
          selectedArtifact: null,
          emptyState: null,
          warnings: unique(warnings.length > 0 ? warnings : ["artifact_catalog_unavailable"])
        };
      }

      const artifacts = rawRows.map((row, index) => normalizeArtifactDescriptor(row, index, idSalt));
      const rowWarnings = artifacts.flatMap((row) => row.warnings);
      const selectedArtifact = selectArtifactDescriptor(artifacts, artifactId);
      return {
        ...envelope(),
        pageId: "web_conversation_artifacts",
        state: artifacts.length === 0 ? "empty" : warnings.length > 0 || rowWarnings.length > 0 ? "degraded" : "available",
        conversationId: safeArtifactConversationId(sessionId),
        artifacts,
        selectedArtifact,
        emptyState: artifacts.length === 0 ? "no_artifacts" : null,
        warnings: unique([...warnings, ...rowWarnings])
      };
    },

    getRuntimeContextViewModel() {
      if (!deps.listActiveTurns) {
        return {
          ...envelope(),
          pageId: "web_runtime_context",
          state: "degraded",
          activeTurns: [],
          warnings: ["runtime_data_unavailable"]
        };
      }

      const warnings: string[] = [];
      const activeTurns = callSafely(() => deps.listActiveTurns?.() ?? [], [], warnings, "runtime_data_unavailable").map(
        (turn): WebReadonlyRuntimeTurnRow => ({
          sessionId: isSafeConversationHandle(turn.sessionId) ? turn.sessionId : conversationHandleForSessionId(turn.sessionId),
          status: safeLabel(turn.status, "unknown"),
          summary: turn.summary ? redactText(turn.summary) : null,
          blockedReason: turn.blockedReason ? safeLabel(turn.blockedReason, "blocked") : null
        })
      );

      return {
        ...envelope(),
        pageId: "web_runtime_context",
        state: warnings.length > 0 ? "degraded" : "available",
        activeTurns,
        warnings: unique(warnings)
      };
    },

    getPendingInteractionsViewModel() {
      if (!deps.listPendingInteractions) {
        return unavailablePendingInteractions(envelope(), "pending_interactions_unavailable");
      }

      const warnings: string[] = [];
      const pendingRows = callSafely(
        () => deps.listPendingInteractions?.() ?? null,
        null as WebReadonlyPendingInteractionInputRow[] | null,
        warnings,
        "pending_interactions_unavailable"
      );
      if (!pendingRows) {
        return unavailablePendingInteractions(envelope(), "pending_interactions_unavailable");
      }

      const pendingInteractions = pendingRows.map((row, index) => normalizePendingInteraction(row, index, idSalt));
      const rowWarnings = pendingInteractions.flatMap((row) => row.warnings);
      return {
        ...envelope(),
        pageId: "web_pending_interactions",
        state: warnings.length > 0 || rowWarnings.length > 0 ? "degraded" : "available",
        pendingInteractions,
        warnings: unique([...warnings, ...rowWarnings])
      };
    },

    getReadinessGuardrailViewModel() {
      const getSnapshot = deps.getReadinessSnapshot ?? deps.store?.getReadinessSnapshot;
      if (!getSnapshot) {
        return {
          ...envelope(),
          pageId: "web_readiness_guardrails",
          state: "unavailable",
          checkedAt: null,
          activePack: null,
          capabilities: [],
          missingGates: ["readiness_data_unavailable"],
          warnings: ["readiness_data_unavailable"]
        };
      }

      const warnings: string[] = [];
      const snapshot = callSafely(getSnapshot, null, warnings, "readiness_data_unavailable");
      if (!snapshot) {
        return {
          ...envelope(),
          pageId: "web_readiness_guardrails",
          state: "unavailable",
          checkedAt: null,
          activePack: null,
          capabilities: [],
          missingGates: ["readiness_data_unavailable"],
          warnings: unique(warnings)
        };
      }

      const details = snapshot.details;
      const missingGates = (details.issues ?? [])
        .map(summarizeIssue)
        .filter((issue): issue is string => Boolean(issue));

      return {
        ...envelope(),
        pageId: "web_readiness_guardrails",
        state: safeLabel(snapshot.state, "unknown"),
        checkedAt: snapshot.checkedAt,
        activePack: details.activePack ? safeLabel(details.activePack, "unknown") : null,
        capabilities: [
          capability("codex_installed", "Codex installed", details.codexInstalled),
          capability("codex_authenticated", "Codex authenticated", details.codexAuthenticated),
          capability("app_server", "App server", details.appServerAvailable),
          capability("operator_binding", "Operator binding", details.authorizedUserBound)
        ],
        missingGates: unique(missingGates),
        warnings: unique(warnings)
      };
    }
  };

  return provider;
}

function unavailableConversationResult(
  envelope: WebReadonlyEnvelope,
  warning: string
): WebReadonlyConversationResultViewModel {
  return {
    ...envelope,
    pageId: "web_conversation_result",
    state: "unavailable",
    conversation: null,
    answers: [],
    runtime: { state: "degraded", activeTurns: [] },
    pendingInteractions: { state: "unavailable", pendingInteractions: [] },
    readiness: { state: "unavailable", missingGates: [] },
    composer: disabledComposerViewModel(),
    warnings: [warning]
  };
}

function disabledComposerViewModel(): WebReadonlyDisabledComposerViewModel {
  return {
    state: "disabled",
    label: "Message Codex",
    placeholder: "Type a message to Codex",
    disabledReason: "Sending from Web is landing next.",
    capability: "web_send_landing_next"
  };
}

function runtimePanelForConversation(
  vm: WebReadonlyRuntimeContextViewModel,
  conversationHandle: string
): Pick<WebReadonlyRuntimeContextViewModel, "state" | "activeTurns"> {
  return {
    state: vm.state,
    activeTurns: vm.activeTurns.filter((turn) => turn.sessionId === conversationHandle)
  };
}

function pendingPanelForConversation(
  vm: WebReadonlyPendingInteractionsViewModel,
  conversationHandle: string
): Pick<WebReadonlyPendingInteractionsViewModel, "state" | "pendingInteractions"> {
  return {
    state: vm.state,
    pendingInteractions: vm.pendingInteractions.filter((row) => row.conversationId === conversationHandle)
  };
}

function readinessPanel(
  vm: WebReadonlyReadinessGuardrailViewModel
): Pick<WebReadonlyReadinessGuardrailViewModel, "state" | "missingGates"> {
  return {
    state: vm.state,
    missingGates: vm.missingGates
  };
}

function unavailablePendingInteractions(
  envelope: WebReadonlyEnvelope,
  warning: string
): WebReadonlyPendingInteractionsViewModel {
  return {
    ...envelope,
    pageId: "web_pending_interactions",
    state: "unavailable",
    pendingInteractions: [],
    warnings: [warning]
  };
}

function unavailableArtifactCatalog(
  envelope: WebReadonlyEnvelope,
  sessionId: string,
  warning: string
): WebReadonlyConversationArtifactCatalogViewModel {
  return {
    ...envelope,
    pageId: "web_conversation_artifacts",
    state: "unavailable",
    conversationId: safeArtifactConversationId(sessionId),
    artifacts: [],
    selectedArtifact: null,
    emptyState: null,
    warnings: [warning]
  };
}

function normalizeArtifactDescriptor(
  row: WebReadonlyArtifactDescriptorInputRow,
  index: number,
  idSalt: string
): WebReadonlyArtifactDescriptorRow {
  const hasRawOnlyData = rowContainsRawOnlyArtifactData(row);
  const label = safeArtifactLabel(firstPrimitiveString(row, ["label", "title", "name"]));
  const kind = safeArtifactKind(firstPrimitiveString(row, ["kind"]), "artifact");
  const type = safeArtifactMediaType(firstPrimitiveString(row, ["type"]));
  const mediaType = safeArtifactMediaType(firstPrimitiveString(row, ["mediaType", "mimeType"]));
  const sizeBytes = safeSizeBytes(row.sizeBytes);
  const createdAt = safeArtifactTimestamp(firstPrimitiveString(row, ["createdAt"]));
  const updatedAt = safeArtifactTimestamp(firstPrimitiveString(row, ["updatedAt"]));
  const warnings = unique([
    label.safe ? "" : "artifact_descriptor_redacted",
    kind.safe ? "" : "artifact_descriptor_redacted",
    type.safe ? "" : "artifact_descriptor_redacted",
    mediaType.safe ? "" : "artifact_descriptor_redacted",
    sizeBytes.safe ? "" : "artifact_descriptor_redacted",
    createdAt.safe ? "" : "artifact_descriptor_redacted",
    updatedAt.safe ? "" : "artifact_descriptor_redacted",
    hasRawOnlyData ? "artifact_descriptor_redacted" : ""
  ]);
  const degraded = warnings.length > 0;
  const previewEligible = !degraded && row.previewEligible === true;
  const downloadEligible = !degraded && row.downloadEligible === true;

  return {
    artifactId: safeArtifactId(row, index, idSalt),
    label: label.text,
    kind: kind.text,
    type: type.text,
    mediaType: mediaType.text,
    sizeBytes: sizeBytes.value,
    createdAt: createdAt.text,
    updatedAt: updatedAt.text,
    availability: degraded ? "degraded" : safeArtifactAvailability(row.availability),
    previewEligible,
    previewLabel: previewEligible ? "Preview eligible" : "Preview unavailable",
    downloadEligible,
    downloadLabel: downloadEligible ? "Download eligible" : "Download unavailable",
    warnings
  };
}

function selectArtifactDescriptor(
  artifacts: WebReadonlyArtifactDescriptorRow[],
  artifactId: string | undefined
): WebReadonlyArtifactDescriptorRow | null {
  if (artifacts.length === 0) {
    return null;
  }
  if (artifactId && isSafePublicOpaqueId(artifactId)) {
    const selected = artifacts.find((artifact) => artifact.artifactId === artifactId);
    if (selected) {
      return selected;
    }
  }
  return artifacts.find((artifact) => artifact.availability === "available") ?? artifacts[0] ?? null;
}

function safeArtifactConversationId(sessionId: string): string {
  return safePublicEntityId(sessionId) ?? "conversation";
}

function safeArtifactId(row: WebReadonlyArtifactDescriptorInputRow, index: number, idSalt: string): string {
  const rawId = firstPrimitiveString(row, ["artifactId", "id", "finalResultId"]);
  if (rawId && isSafePublicOpaqueId(rawId) && !containsUnsafeArtifactValue(rawId)) {
    return rawId;
  }

  const stableKey = [
    rawId,
    firstPrimitiveString(row, ["label", "title", "name", "filename"]),
    firstPrimitiveString(row, ["kind", "type", "mediaType", "mimeType"]),
    firstPrimitiveString(row, ["createdAt"]),
    firstPrimitiveString(row, ["updatedAt"]),
    String(index)
  ].join("\0");
  return `art_${hashOpaque(idSalt, stableKey)}`;
}

function safeArtifactLabel(value: string | null): { safe: boolean; text: string } {
  const raw = String(value ?? "").trim();
  if (!raw || looksPathLike(raw) || containsUnsafeArtifactValue(raw)) {
    return { safe: !raw, text: "Artifact descriptor" };
  }
  const stripped = stripTinySafeHtml(raw);
  if (!stripped) {
    return { safe: false, text: "Artifact descriptor" };
  }
  const text = redactText(decodeBasicHtmlEntities(stripped)).trim();
  if (!text || looksPathLike(text) || text.includes("[redacted-") || containsUnsafeArtifactValue(text)) {
    return { safe: false, text: "Artifact descriptor" };
  }
  return { safe: true, text };
}

function safeArtifactKind(value: string | null, fallback: string): { safe: boolean; text: string } {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!raw) {
    return { safe: true, text: fallback };
  }
  if (!/^[a-z0-9_.:-]{1,80}$/.test(raw) || looksPathLike(raw) || containsUnsafeArtifactValue(raw)) {
    return { safe: false, text: fallback };
  }
  return { safe: true, text: raw };
}

function safeArtifactMediaType(value: string | null): { safe: boolean; text: string | null } {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) {
    return { safe: true, text: null };
  }
  if (
    !/^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/.test(raw)
    || looksPathLike(raw)
    || containsUnsafeArtifactValue(raw)
  ) {
    return { safe: false, text: null };
  }
  return { safe: true, text: raw };
}

function safeArtifactAvailability(value: string | null | undefined): WebReadonlyAvailability {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "available" || raw === "unavailable" || raw === "degraded" ? raw : "available";
}

function safeArtifactTimestamp(value: string | null): { safe: boolean; text: string | null } {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { safe: true, text: null };
  }
  if (looksPathLike(raw) || containsUnsafeArtifactValue(raw)) {
    return { safe: false, text: null };
  }
  return { safe: true, text: raw };
}

function safeSizeBytes(value: unknown): { safe: boolean; value: number | null } {
  if (value === null || value === undefined || value === "") {
    return { safe: true, value: null };
  }
  const size = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  if (!Number.isSafeInteger(size) || size < 0) {
    return { safe: false, value: null };
  }
  return { safe: true, value: size };
}

function rowContainsRawOnlyArtifactData(row: WebReadonlyArtifactDescriptorInputRow): boolean {
  return [
    "path",
    "filePath",
    "downloadPath",
    "previewPath",
    "url",
    "uri",
    "href",
    "downloadUrl",
    "previewUrl",
    "localPath",
    "tempPath",
    "platformResourceId",
    "resourceId",
    "messageId",
    "deliveryMessageId",
    "callback",
    "callback_data",
    "chatId",
    "telegramChatId",
    "feishuChatId",
    "threadId",
    "rawJson",
    "rawProtocol",
    "protocol",
    "terminal",
    "rawTerminal",
    "stdout",
    "stderr",
    "logs"
  ].some((key) => Object.prototype.hasOwnProperty.call(row, key));
}

function normalizePendingInteraction(
  row: WebReadonlyPendingInteractionInputRow,
  index: number,
  idSalt: string
): WebReadonlyPendingInteractionViewRow {
  const rawSessionId = primitiveString(row.sessionId);
  const rawConversationId = primitiveString(row.conversationId) ?? rawSessionId;
  const sessionId = null;
  const conversationId = rawConversationId
    ? isSafeConversationHandle(rawConversationId) ? rawConversationId : conversationHandleForRawSessionId(idSalt, rawConversationId)
    : null;
  const summary = sanitizePendingInteractionSummary(firstPrimitiveString(row, ["summary"]));
  const blockingReason = sanitizePendingInteractionText(
    firstPrimitiveString(row, ["blockingReason", "blockedReason", "reason"])
  );
  const warnings = unique([
    summary.state === "unavailable" && summary.reason === "unsafe_pending_interaction_summary"
      ? "pending_interaction_details_redacted"
      : "",
    blockingReason.safe ? "" : "pending_interaction_details_redacted",
    rowContainsRawOnlyPendingData(row) ? "pending_interaction_details_redacted" : ""
  ]);

  return {
    interactionId: safePendingInteractionId(row, index, idSalt),
    conversationId,
    sessionId,
    status: safePendingLabel(firstPrimitiveString(row, ["status", "state"]), "pending"),
    kind: safePendingLabel(firstPrimitiveString(row, ["kind", "type", "category"]), "interaction"),
    createdAt: safeTimestamp(row.createdAt),
    updatedAt: safeTimestamp(row.updatedAt),
    blockingReason: blockingReason.text ?? "Awaiting user input; details hidden for this read-only surface.",
    summary,
    availability: warnings.length > 0 ? "degraded" : "available",
    warnings
  };
}

function safePendingInteractionId(row: WebReadonlyPendingInteractionInputRow, index: number, idSalt: string): string {
  const rawId = firstPrimitiveString(row, ["interactionId", "id", "pendingInteractionId"]);
  const stableKey = [
    rawId,
    primitiveString(row.sessionId),
    primitiveString(row.conversationId),
    primitiveString(row.status),
    primitiveString(row.kind),
    primitiveString(row.createdAt),
    primitiveString(row.updatedAt),
    String(index)
  ].join("\0");
  return `pi_${hashOpaque(idSalt, stableKey)}`;
}

function safePublicEntityId(value: string | null): string | null {
  if (!value || !isSafePublicOpaqueId(value)) {
    return null;
  }
  return value;
}

function isSafePublicOpaqueId(value: string): boolean {
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(trimmed)
    && !looksPathLike(trimmed)
    && !containsUnsafePendingValue(trimmed)
    && !/^(?:ou|oc|om|on|cli|msg|message|chat)_/i.test(trimmed)
    && !/\b(?:telegram|feishu|chat|message|platform|path)\b/i.test(trimmed);
}

function conversationHandleForRawSessionId(idSalt: string, sessionId: string): string {
  return `cv_${hashOpaque(idSalt, sessionId)}`;
}

function isSafeConversationHandle(value: string): boolean {
  return /^cv_[a-f0-9]{16}$/.test(value.trim());
}

function safePendingLabel(value: string | null, fallback: string): string {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!raw || looksPathLike(raw) || containsUnsafePendingValue(raw) || !/^[a-z0-9_.:-]{1,80}$/.test(raw)) {
    return fallback;
  }
  return raw;
}

function safeTimestamp(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || looksPathLike(raw) || containsUnsafePendingValue(raw)) {
    return null;
  }
  return raw;
}

function sanitizePendingInteractionSummary(
  value: string | null
): WebReadonlyPendingInteractionSummaryUnavailable | WebReadonlyPendingInteractionSummaryAvailable {
  const text = sanitizePendingInteractionText(value);
  if (text.safe && text.text) {
    return { state: "available", text: text.text };
  }
  return {
    state: "unavailable",
    reason: text.reason === "unsafe" ? "unsafe_pending_interaction_summary" : "pending_interaction_summary_not_provided"
  };
}

function sanitizePendingInteractionText(value: string | null): { safe: boolean; text: string | null; reason: "missing" | "unsafe" | null } {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { safe: true, text: null, reason: "missing" };
  }
  if (containsUnsafePendingValue(raw)) {
    return { safe: false, text: null, reason: "unsafe" };
  }

  const stripped = stripTinySafeHtml(raw);
  if (!stripped) {
    return { safe: false, text: null, reason: "unsafe" };
  }

  const text = redactText(decodeBasicHtmlEntities(stripped))
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!text) {
    return { safe: true, text: null, reason: "missing" };
  }
  if (containsUnsafePendingValue(text)) {
    return { safe: false, text: null, reason: "unsafe" };
  }
  return { safe: true, text, reason: null };
}

function rowContainsRawOnlyPendingData(row: WebReadonlyPendingInteractionInputRow): boolean {
  return [
    "promptJson",
    "responseJson",
    "replyMarkup",
    "callback",
    "callback_data",
    "messageId",
    "platformMessageId",
    "deliveryMessageId",
    "chatId",
    "telegramChatId",
    "feishuChatId",
    "feishuMessageId",
    "openId",
    "open_id",
    "unionId",
    "union_id",
    "userId",
    "user_id",
    "rawTerminal",
    "terminal"
  ].some((key) => Object.prototype.hasOwnProperty.call(row, key));
}

function containsUnsafePendingValue(value: string): boolean {
  return containsUnsafeControlMarkup(value)
    || /(?:callback|callback_data|replyMarkup|messageId|platformMessageId|deliveryMessageId|chatId|telegramChatId)/i.test(value)
    || /(?:open_id|union_id|user_id|chat_id|message_id)/i.test(value)
    || /(?:telegram|feishu|rawTerminal|stdout|stderr)/i.test(value)
    || /(?:raw\s*terminal|terminal\s*(?:output|snippet))/i.test(value)
    || /(?:submit|approv\w*|interrupt|upload|switch|resume)/i.test(value);
}

function containsUnsafeArtifactValue(value: string): boolean {
  return containsUnsafeControlMarkup(value)
    || looksPathLike(value)
    || /\b(?:https?|file|tg|javascript|callback):/i.test(value)
    || /(?:callback|callback_data|replyMarkup|messageId|platformMessageId|deliveryMessageId|chatId|telegramChatId|threadId)/i.test(value)
    || /(?:open_id|union_id|user_id|chat_id|message_id|thread_id|resource_id)/i.test(value)
    || /(?:telegram|feishu|platformResourceId|rawProtocol|rawJson|protocol|rawTerminal|stdout|stderr|terminal)/i.test(value)
    || /(?:submit|approv\w*|interrupt|upload|switch|resume)/i.test(value)
    || /\b[\w.-]+\.(?:png|jpe?g|gif|webp|pdf|txt|md|log|json|zip|tar|gz|mp4|mov|wav|mp3)\b/i.test(value);
}

function firstPrimitiveString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = primitiveString(row[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function primitiveString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function capability(key: string, label: string, value: boolean | undefined): WebReadonlyReadinessCapabilityRow {
  const observed: WebReadonlyObservedState = value === true ? "present" : value === false ? "missing" : "unknown";
  return {
    key,
    label,
    declared: "present",
    configured: observed,
    observed,
    uxExposed: "missing"
  };
}

function hashOpaque(salt: string, value: string): string {
  return createHash("sha256").update(salt).update("\0").update(value).digest("hex").slice(0, 16);
}

function safeLabel(value: string | null | undefined, fallback: string): string {
  const redacted = redactText(String(value ?? "").trim());
  return redacted.length > 0 ? redacted : fallback;
}

function safeOptionalLabel(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (raw.length === 0 || looksPathLike(raw) || containsUnsafeControlMarkup(raw)) {
    return null;
  }
  const redacted = redactText(raw).trim();
  if (redacted.length === 0 || redacted.includes("[redacted-path]") || containsUnsafeControlMarkup(redacted)) {
    return null;
  }
  return redacted;
}

function safeWorkspaceLabel(workspaceId: string, label: string | null | undefined): string {
  return safeOptionalLabel(label) ?? `Workspace ${workspaceId.slice(3, 11)}`;
}

function sanitizeFinalAnswerBody(value: string | null | undefined): WebReadonlyAnswerBodyUnavailable | WebReadonlyAnswerBodyAvailable {
  const raw = String(value ?? "").trim();
  if (raw.length === 0) {
    return { state: "unavailable", reason: "sanitized_body_not_provided" };
  }
  if (containsUnsafeControlMarkup(raw)) {
    return { state: "unavailable", reason: "unsafe_final_answer_body" };
  }
  if (containsForbiddenBodySource(raw)) {
    return { state: "unavailable", reason: "unsafe_final_answer_body" };
  }

  const stripped = stripTinySafeHtml(raw);
  if (!stripped) {
    return { state: "unavailable", reason: "unsafe_final_answer_body" };
  }

  const decoded = decodeBasicHtmlEntities(stripped);
  if (containsUnsafeControlMarkup(decoded)) {
    return { state: "unavailable", reason: "unsafe_final_answer_body" };
  }
  if (containsForbiddenBodySource(decoded)) {
    return { state: "unavailable", reason: "unsafe_final_answer_body" };
  }

  const text = redactText(decoded)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (text.length === 0) {
    return { state: "unavailable", reason: "sanitized_body_not_provided" };
  }
  if (containsUnsafeControlMarkup(text)) {
    return { state: "unavailable", reason: "unsafe_final_answer_body" };
  }
  return { state: "available", text };
}

function finalAnswerSummary(body: WebReadonlyAnswerBodyUnavailable | WebReadonlyAnswerBodyAvailable): string {
  if (body.state === "available") {
    return "Final answer body was provided by an injected Web-safe sanitizer.";
  }
  if (body.reason === "unsafe_final_answer_body") {
    return "Final answer body was rejected by the Web safety filter.";
  }
  return "Final answer is available, but body is hidden until a Web-safe sanitized body is provided.";
}

function stripTinySafeHtml(value: string): string | null {
  let rejected = false;
  const text = value.replace(/<\/?([A-Za-z][A-Za-z0-9:-]*)(?:\s[^<>]*)?>/g, (match, tagName: string) => {
    const tag = tagName.toLowerCase();
    if (!/^(?:<\/?(?:b|strong|i|em|code|pre|p)\s*>|<br\s*\/?>)$/i.test(match)) {
      rejected = true;
      return "";
    }
    if (tag === "br" || tag === "p") {
      return "\n";
    }
    return "";
  });
  return rejected ? null : text;
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function containsUnsafeControlMarkup(value: string): boolean {
  return [
    /<\s*(?:script|style|a|button|form|input|textarea|select)\b/i,
    /\b(?:callback|callback_data|replyMarkup|messageId|deliveryMessageId|primaryActionConsumed|actionId|platformMessageId)\b/i,
    /\b(?:submit|approve|interrupt|upload|switch|resume)\b/i,
    /(?:^|["'(\s])(?:tg|javascript|callback):/i,
    /\[[^\]]+\]\((?:tg|javascript|callback):[^)]*\)/i
  ].some((pattern) => pattern.test(value));
}

function containsForbiddenBodySource(value: string): boolean {
  return [
    /\bfile:\/\/[^\s"'<>)]*/i,
    /(?:^|[\s"'(])(?:\/(?:home|tmp|var|etc|root|Users|usr)\/[^\s<>"']*|~\/[^\s<>"']*|[A-Za-z]:\\[^\s<>"']*)/,
    /\bhttps?:\/\/[^\s"'<>)]*[?&](?:access_?token|auth|authorization|bearer|key|sig|signature|token)=[^\s"'<>)]*/i,
    /(?:^|["'(\s])(?:feishu|lark):\/\//i
  ].some((pattern) => pattern.test(value));
}

function looksPathLike(value: string): boolean {
  return /(?:^|[\s"'(])(?:\/|~\/|[A-Za-z]:\\)/.test(value);
}

function redactText(value: string): string {
  return value
    .replace(/\b(?:https?|file):\/\/[^\s"'<>)]*/gi, "[redacted-url]")
    .replace(/\/home\/[A-Za-z0-9._-]+(?:\/[^\s"'<>)]*)*/g, "[redacted-path]")
    .replace(/\/tmp(?:\/[^\s"'<>)]*)*/g, "[redacted-path]")
    .replace(/\bchatId\b/g, "chat-id")
    .replace(/\btelegramChatId\b/g, "platform-chat-id")
    .replace(/\bmessageId\b/g, "message-id")
    .replace(/\breplyMarkup\b/g, "reply-markup")
    .replace(/\bpromptJson\b/g, "prompt-json")
    .replace(/\bresponseJson\b/g, "response-json");
}

function summarizeIssue(value: string): string | null {
  const redacted = redactText(value).replace(/\s+at\s+\[redacted-path\].*$/i, "").trim();
  return redacted.length > 0 ? redacted : null;
}

function latestIso(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return right > left ? right : left;
}

function compareWorkspaceRows(left: WorkspaceAccumulator, right: WorkspaceAccumulator): number {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }
  const leftLast = left.lastActivityAt ?? "";
  const rightLast = right.lastActivityAt ?? "";
  return rightLast.localeCompare(leftLast) || (left.label ?? "").localeCompare(right.label ?? "");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function callSafely<T>(fn: (() => T) | undefined, fallback: T, warnings: string[], warning: string): T {
  if (!fn) {
    return fallback;
  }
  try {
    return fn();
  } catch {
    if (warning) {
      warnings.push(warning);
    }
    return fallback;
  }
}
