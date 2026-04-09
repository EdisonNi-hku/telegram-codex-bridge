import type { ReadinessSnapshot } from "../../types.js";
import type { PackHealthCheck, PackHealthReport } from "../contract.js";

export const FEISHU_SETUP_CHECKLIST = [
  "enable bot ability in the Feishu app",
  "grant im:message.p2p_msg:readonly",
  "enable long connection",
  "subscribe to im.message.receive_v1",
  "enable card.action.trigger",
  "publish the latest app version after permission or callback changes"
] as const;

const FEISHU_TEXT_INGRESS_CHECK_ID = "feishu_text_ingress_observed";
const FEISHU_INTERACTIVE_SEND_CHECK_ID = "feishu_interactive_card_delivery_observed";
const FEISHU_CALLBACK_CHECK_ID = "feishu_card_callback_observed";
const FEISHU_CONTENTION_CHECK_ID = "feishu_shared_app_contention_suspected";

const FEISHU_OBSERVED_CHECK_IDS = new Set([
  FEISHU_TEXT_INGRESS_CHECK_ID,
  FEISHU_INTERACTIVE_SEND_CHECK_ID,
  FEISHU_CALLBACK_CHECK_ID,
  FEISHU_CONTENTION_CHECK_ID
]);

const FEISHU_SETUP_METADATA_KEYS = {
  epoch: "feishuSetupEpoch",
  textIngressAt: "feishuLastTextIngressAt",
  interactiveCardSentAt: "feishuLastInteractiveCardSentAt",
  cardCallbackAt: "feishuLastCardCallbackAt",
  interactiveErrorCode: "feishuLastInteractiveErrorCode",
  interactiveError: "feishuLastInteractiveError"
} as const;

type PackMetadata = Record<string, string | boolean | null | undefined>;

export interface FeishuSetupObservations {
  setupEpoch: string | null;
  lastTextIngressAt: string | null;
  lastInteractiveCardSentAt: string | null;
  lastCardCallbackAt: string | null;
  lastInteractiveErrorCode: string | null;
  lastInteractiveError: string | null;
}

export interface FeishuSetupObservationPatch {
  lastTextIngressAt?: string | null;
  lastInteractiveCardSentAt?: string | null;
  lastCardCallbackAt?: string | null;
  lastInteractiveErrorCode?: string | null;
  lastInteractiveError?: string | null;
}

function readStringMetadata(
  metadata: PackMetadata | undefined,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function readFeishuSetupObservations(
  metadata: PackMetadata | undefined
): FeishuSetupObservations {
  return {
    setupEpoch: readStringMetadata(metadata, FEISHU_SETUP_METADATA_KEYS.epoch),
    lastTextIngressAt: readStringMetadata(metadata, FEISHU_SETUP_METADATA_KEYS.textIngressAt),
    lastInteractiveCardSentAt: readStringMetadata(metadata, FEISHU_SETUP_METADATA_KEYS.interactiveCardSentAt),
    lastCardCallbackAt: readStringMetadata(metadata, FEISHU_SETUP_METADATA_KEYS.cardCallbackAt),
    lastInteractiveErrorCode: readStringMetadata(metadata, FEISHU_SETUP_METADATA_KEYS.interactiveErrorCode),
    lastInteractiveError: readStringMetadata(metadata, FEISHU_SETUP_METADATA_KEYS.interactiveError)
  };
}

export function resetFeishuSetupMetadata(
  metadata: PackMetadata | undefined,
  timestamp: string
): PackMetadata {
  return {
    ...(metadata ?? {}),
    [FEISHU_SETUP_METADATA_KEYS.epoch]: timestamp,
    [FEISHU_SETUP_METADATA_KEYS.textIngressAt]: null,
    [FEISHU_SETUP_METADATA_KEYS.interactiveCardSentAt]: null,
    [FEISHU_SETUP_METADATA_KEYS.cardCallbackAt]: null,
    [FEISHU_SETUP_METADATA_KEYS.interactiveErrorCode]: null,
    [FEISHU_SETUP_METADATA_KEYS.interactiveError]: null
  };
}

export function mergeFeishuSetupMetadata(
  metadata: PackMetadata | undefined,
  patch: FeishuSetupObservationPatch,
  timestamp: string
): PackMetadata {
  const next = {
    ...(metadata ?? {})
  };

  if (!readStringMetadata(next, FEISHU_SETUP_METADATA_KEYS.epoch)) {
    next[FEISHU_SETUP_METADATA_KEYS.epoch] = timestamp;
  }

  if (patch.lastTextIngressAt !== undefined) {
    next[FEISHU_SETUP_METADATA_KEYS.textIngressAt] = patch.lastTextIngressAt;
  }
  if (patch.lastInteractiveCardSentAt !== undefined) {
    next[FEISHU_SETUP_METADATA_KEYS.interactiveCardSentAt] = patch.lastInteractiveCardSentAt;
  }
  if (patch.lastCardCallbackAt !== undefined) {
    next[FEISHU_SETUP_METADATA_KEYS.cardCallbackAt] = patch.lastCardCallbackAt;
  }
  if (patch.lastInteractiveErrorCode !== undefined) {
    next[FEISHU_SETUP_METADATA_KEYS.interactiveErrorCode] = patch.lastInteractiveErrorCode;
  }
  if (patch.lastInteractiveError !== undefined) {
    next[FEISHU_SETUP_METADATA_KEYS.interactiveError] = patch.lastInteractiveError;
  }

  return next;
}

function buildObservedChecks(
  observations: FeishuSetupObservations,
  authorized: boolean
): PackHealthCheck[] {
  const hasTextIngress = observations.lastTextIngressAt !== null;
  const hasInteractiveSend = observations.lastInteractiveCardSentAt !== null;
  const hasCardCallback = observations.lastCardCallbackAt !== null;
  const checks: PackHealthCheck[] = [
    {
      id: FEISHU_TEXT_INGRESS_CHECK_ID,
      ok: hasTextIngress,
      summary: hasTextIngress
        ? `feishu text ingress observed at ${observations.lastTextIngressAt}`
        : "feishu text ingress has not been observed for this setup cycle",
      blocking: true,
      source: "observed"
    },
    {
      id: FEISHU_INTERACTIVE_SEND_CHECK_ID,
      ok: hasInteractiveSend,
      summary: hasInteractiveSend
        ? `feishu interactive card delivery observed at ${observations.lastInteractiveCardSentAt}`
        : observations.lastInteractiveErrorCode
          ? `feishu interactive card delivery failed with code ${observations.lastInteractiveErrorCode}; ${observations.lastInteractiveError ?? "verify card.action.trigger and publish the latest app version"}`
          : "feishu interactive card delivery has not been observed for this setup cycle",
      blocking: true,
      source: "observed"
    },
    {
      id: FEISHU_CALLBACK_CHECK_ID,
      ok: hasCardCallback,
      summary: hasCardCallback
        ? `feishu card callback observed at ${observations.lastCardCallbackAt}`
        : "feishu card callback has not been observed for this setup cycle",
      blocking: true,
      source: "observed"
    }
  ];

  checks.push({
    id: FEISHU_CONTENTION_CHECK_ID,
    ok: hasTextIngress || !authorized,
    summary: hasTextIngress || !authorized
      ? "no shared-app contention signal detected"
      : "no Feishu inbound events have been observed after authorization; another long-connection client may be consuming events for this app",
    blocking: false,
    source: "heuristic"
  });

  return checks;
}

export function buildFeishuSetupHealth(options: {
  report: PackHealthReport;
  authorized: boolean;
}): Pick<PackHealthReport, "checks" | "issues" | "metadata" | "setupState" | "setupChecklist"> {
  const metadata = {
    ...(options.report.metadata ?? {})
  };
  const observations = readFeishuSetupObservations(metadata);
  const baseChecks = options.report.checks.filter((check) => !FEISHU_OBSERVED_CHECK_IDS.has(check.id));
  const observedChecks = buildObservedChecks(observations, options.authorized);
  const checks = [...baseChecks, ...observedChecks];
  const setupState = options.authorized
    && observations.lastTextIngressAt
    && observations.lastInteractiveCardSentAt
    && observations.lastCardCallbackAt
    ? "complete"
    : "incomplete";
  const issues = checks.filter((check) => !check.ok).map((check) => check.summary);

  return {
    checks,
    issues,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    setupState,
    setupChecklist: [...FEISHU_SETUP_CHECKLIST]
  };
}

export function applyFeishuSetupToSnapshot(snapshot: ReadinessSnapshot): ReadinessSnapshot {
  if (snapshot.details.activePack !== "feishu") {
    return snapshot;
  }

  const merged = buildFeishuSetupHealth({
    report: {
      state: snapshot.details.packState ?? "awaiting_authorization",
      checks: snapshot.details.packChecks ?? [],
      issues: snapshot.details.packIssues ?? [],
      ...(snapshot.details.packMetadata ? { metadata: snapshot.details.packMetadata } : {})
    },
    authorized: snapshot.details.authorizedUserBound
  });
  const sharedIssues = snapshot.details.sharedIssues
    ?? snapshot.details.issues.filter((issue) =>
      !(snapshot.details.packChecks ?? []).some((check) => check.summary === issue)
    );

  return {
    ...snapshot,
    details: {
      ...snapshot.details,
      ...(merged.setupState ? { setupState: merged.setupState } : {}),
      ...(merged.setupChecklist ? { setupChecklist: merged.setupChecklist } : {}),
      packChecks: merged.checks,
      packIssues: merged.issues,
      ...(merged.metadata ? { packMetadata: merged.metadata } : {}),
      sharedIssues,
      issues: [...sharedIssues, ...merged.issues]
    }
  };
}

export function resetFeishuSetupCycle(snapshot: ReadinessSnapshot, timestamp: string): ReadinessSnapshot {
  if (snapshot.details.activePack !== "feishu") {
    return snapshot;
  }

  return applyFeishuSetupToSnapshot({
    ...snapshot,
    checkedAt: timestamp,
    details: {
      ...snapshot.details,
      packMetadata: resetFeishuSetupMetadata(snapshot.details.packMetadata, timestamp)
    }
  });
}

export function applyFeishuSetupObservation(
  snapshot: ReadinessSnapshot,
  patch: FeishuSetupObservationPatch,
  timestamp: string
): ReadinessSnapshot {
  if (snapshot.details.activePack !== "feishu") {
    return snapshot;
  }

  return applyFeishuSetupToSnapshot({
    ...snapshot,
    checkedAt: timestamp,
    details: {
      ...snapshot.details,
      packMetadata: mergeFeishuSetupMetadata(snapshot.details.packMetadata, patch, timestamp)
    }
  });
}
