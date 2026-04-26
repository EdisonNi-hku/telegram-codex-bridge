import {
  createWebReadonlyViewModelProvider,
  type WebReadonlyActiveTurn,
  type WebReadonlyArtifactDescriptorInputRow,
  type WebReadonlyFinalAnswerRow,
  type WebReadonlyOperatorBinding,
  type WebReadonlyPendingInteractionInputRow,
  type WebReadonlyReadinessSnapshot,
  type WebReadonlyRecentProjectRow,
  type WebReadonlySessionProjectStatsRow,
  type WebReadonlySessionRow,
  type WebReadonlyStoreReader,
  type WebReadonlyViewModelDeps,
  type WebReadonlyViewModelProvider
} from "./web-readonly-view-model.js";

export interface WebReadonlyLiveOperatorBindingCandidate {
  chatId: string;
  [key: string]: unknown;
}

export interface WebReadonlyLiveAuthReader {
  listOperatorBindings?: () => WebReadonlyLiveOperatorBindingCandidate[] | null | undefined;
}

export interface WebReadonlyLiveStoreReader {
  listRecentProjects?: () => WebReadonlyRecentProjectRow[];
  listSessionProjectStats?: () => WebReadonlySessionProjectStatsRow[];
  listSessions?: (chatId: string, options?: { archived?: boolean; limit?: number }) => WebReadonlySessionRow[];
  getSessionById?: (sessionId: string) => WebReadonlySessionRow | null;
  listFinalAnswerViews?: (chatId: string) => WebReadonlyFinalAnswerRow[];
  getReadinessSnapshot?: () => WebReadonlyReadinessSnapshot | null;
  listPendingInteractions?: (chatId: string) => WebReadonlyPendingInteractionInputRow[] | null | undefined;
}

export interface WebReadonlyLiveReadinessReader {
  getReadinessSnapshot?: () => WebReadonlyReadinessSnapshot | null | undefined;
}

export interface WebReadonlyLiveRuntimeReader {
  listActiveTurns?: (chatId: string) => WebReadonlyActiveTurn[] | null | undefined;
}

export interface WebReadonlyLiveArtifactReader {
  listArtifactDescriptors?: (sessionId: string) => WebReadonlyArtifactDescriptorInputRow[] | null | undefined;
}

export interface WebReadonlyLiveFinalAnswerBodyReader {
  getSanitizedFinalAnswerBody?: (answer: WebReadonlyFinalAnswerRow) => string | null | undefined;
}

export interface WebReadonlyLiveProviderDeps {
  auth?: WebReadonlyLiveAuthReader;
  store?: WebReadonlyLiveStoreReader;
  readiness?: WebReadonlyLiveReadinessReader;
  runtime?: WebReadonlyLiveRuntimeReader;
  artifacts?: WebReadonlyLiveArtifactReader;
  finalAnswerBodies?: WebReadonlyLiveFinalAnswerBodyReader;
  now?: () => string;
  idSalt?: string;
}

export function createWebReadonlyLiveProvider(deps: WebReadonlyLiveProviderDeps): WebReadonlyViewModelProvider {
  const binding = resolveSingleOperatorBinding(deps.auth);
  if (!binding) {
    return createWebReadonlyViewModelProvider(baseProviderDeps(deps));
  }

  const providerDeps = baseProviderDeps(deps);
  providerDeps.operatorBinding = binding;
  const scopedStore = createScopedStoreReader(deps.store, binding);
  if (scopedStore) {
    providerDeps.store = scopedStore;
  }
  if (deps.runtime?.listActiveTurns) {
    providerDeps.listActiveTurns = () => deps.runtime?.listActiveTurns?.(binding.chatId);
  }
  if (deps.store?.listPendingInteractions) {
    providerDeps.listPendingInteractions = () => deps.store?.listPendingInteractions?.(binding.chatId);
  }
  if (deps.artifacts?.listArtifactDescriptors) {
    providerDeps.listArtifactDescriptors = deps.artifacts.listArtifactDescriptors;
  }
  const getReadinessSnapshot = deps.readiness?.getReadinessSnapshot ?? deps.store?.getReadinessSnapshot;
  if (getReadinessSnapshot) {
    providerDeps.getReadinessSnapshot = getReadinessSnapshot;
  }
  if (deps.finalAnswerBodies?.getSanitizedFinalAnswerBody) {
    providerDeps.getSanitizedFinalAnswerBody = deps.finalAnswerBodies.getSanitizedFinalAnswerBody;
  }
  return createWebReadonlyViewModelProvider(providerDeps);
}

function baseProviderDeps(deps: WebReadonlyLiveProviderDeps): WebReadonlyViewModelDeps {
  const providerDeps: WebReadonlyViewModelDeps = {};
  if (deps.now) {
    providerDeps.now = deps.now;
  }
  if (deps.idSalt) {
    providerDeps.idSalt = deps.idSalt;
  }
  return providerDeps;
}

function resolveSingleOperatorBinding(auth: WebReadonlyLiveAuthReader | undefined): WebReadonlyOperatorBinding | null {
  if (!auth?.listOperatorBindings) {
    return null;
  }

  let rows: WebReadonlyLiveOperatorBindingCandidate[] | null | undefined;
  try {
    rows = auth.listOperatorBindings();
  } catch {
    return null;
  }

  const bindings = (rows ?? [])
    .map((row) => ({ chatId: normalizeChatId(row.chatId) }))
    .filter((row): row is WebReadonlyOperatorBinding => Boolean(row.chatId));
  if (bindings.length !== 1) {
    return null;
  }
  return bindings[0] ?? null;
}

function createScopedStoreReader(
  store: WebReadonlyLiveStoreReader | undefined,
  binding: WebReadonlyOperatorBinding
): WebReadonlyStoreReader | undefined {
  if (!store) {
    return undefined;
  }

  const scopedStore: WebReadonlyStoreReader = {};
  if (store.listSessions) {
    scopedStore.listSessions = (_chatId, options) => store.listSessions?.(binding.chatId, options) ?? [];
  }
  if (store.getSessionById) {
    scopedStore.getSessionById = (sessionId) => scopedSession(store.getSessionById?.(sessionId) ?? null, binding);
  }
  if (store.listFinalAnswerViews) {
    scopedStore.listFinalAnswerViews = (_chatId) =>
      (store.listFinalAnswerViews?.(binding.chatId) ?? []).filter((answer) => answerBelongsToBinding(answer, binding));
  }
  if (store.getReadinessSnapshot) {
    scopedStore.getReadinessSnapshot = store.getReadinessSnapshot;
  }
  return scopedStore;
}

function scopedSession(session: WebReadonlySessionRow | null, binding: WebReadonlyOperatorBinding): WebReadonlySessionRow | null {
  if (!session) {
    return null;
  }
  const chatIds = [session.chatId, session.telegramChatId]
    .map((value) => normalizeChatId(value))
    .filter((value): value is string => Boolean(value));
  if (chatIds.length === 0 || !chatIds.includes(binding.chatId)) {
    return null;
  }
  return session;
}

function answerBelongsToBinding(answer: WebReadonlyFinalAnswerRow, binding: WebReadonlyOperatorBinding): boolean {
  const chatId = normalizeChatId(answer.chatId);
  return !chatId || chatId === binding.chatId;
}

function normalizeChatId(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}
