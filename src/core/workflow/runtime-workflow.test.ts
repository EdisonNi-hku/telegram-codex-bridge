import test from "node:test";
import assert from "node:assert/strict";

import type { InspectSnapshot } from "../../activity/types.js";
import { createRuntimeStatusCardView, createRuntimeStatusControlsView } from "./runtime-workflow.js";

function createInspectSnapshot(overrides: Partial<InspectSnapshot> = {}): InspectSnapshot {
  return {
    turnStatus: overrides.turnStatus ?? "running",
    threadRuntimeState: overrides.threadRuntimeState ?? "active",
    activeItemType: overrides.activeItemType ?? "commandExecution",
    activeItemId: overrides.activeItemId ?? "item-1",
    activeItemLabel: overrides.activeItemLabel ?? "pnpm test",
    lastActivityAt: overrides.lastActivityAt ?? "2026-03-10T10:00:05.000Z",
    currentItemStartedAt: overrides.currentItemStartedAt ?? "2026-03-10T10:00:00.000Z",
    currentItemDurationSec: overrides.currentItemDurationSec ?? 5,
    lastHighValueEventType: overrides.lastHighValueEventType ?? null,
    lastHighValueTitle: overrides.lastHighValueTitle ?? null,
    lastHighValueDetail: overrides.lastHighValueDetail ?? null,
    latestProgress: overrides.latestProgress ?? "正在整理运行摘要。",
    recentStatusUpdates: overrides.recentStatusUpdates ?? [],
    threadBlockedReason: overrides.threadBlockedReason ?? null,
    finalMessageAvailable: overrides.finalMessageAvailable ?? false,
    inspectAvailable: overrides.inspectAvailable ?? true,
    debugAvailable: overrides.debugAvailable ?? true,
    errorState: overrides.errorState ?? null,
    recentTransitions: overrides.recentTransitions ?? [],
    recentCommandSummaries: overrides.recentCommandSummaries ?? [],
    recentFileChangeSummaries: overrides.recentFileChangeSummaries ?? [],
    recentMcpSummaries: overrides.recentMcpSummaries ?? [],
    recentWebSearches: overrides.recentWebSearches ?? [],
    recentHookSummaries: overrides.recentHookSummaries ?? [],
    recentNoticeSummaries: overrides.recentNoticeSummaries ?? [],
    planSnapshot: overrides.planSnapshot ?? ["1. 收敛实现边界", "2. 保持 Telegram UX"],
    proposedPlanSnapshot: (overrides as InspectSnapshot).proposedPlanSnapshot ?? [],
    agentSnapshot: overrides.agentSnapshot ?? [{
      threadId: "agent-1",
      label: "Noether",
      labelSource: "nickname",
      status: "pendingInit",
      progress: "Booting"
    }],
    completedCommentary: overrides.completedCommentary ?? ["正在整理运行摘要。"],
    tokenUsage: overrides.tokenUsage ?? null,
    latestDiffSummary: overrides.latestDiffSummary ?? null,
    terminalInteractionSummary: overrides.terminalInteractionSummary ?? null,
    pendingInteractions: overrides.pendingInteractions ?? [],
    answeredInteractions: overrides.answeredInteractions ?? []
  };
}

test("createRuntimeStatusCardView reduces inspect state into a semantic runtime card view", () => {
  const inspect = createInspectSnapshot();

  const view = createRuntimeStatusCardView({
    sessionId: "session-1",
    context: {
      sessionId: "session-1",
      sessionName: "Session Alpha",
      projectName: "Project One"
    },
    language: "zh",
    inspect,
    optionalFieldLines: ["模型 · gpt-5", "目录 · /tmp/project-one"],
    planExpanded: true,
    agentsExpanded: false
  });

  assert.deepEqual(view, {
    sessionId: "session-1",
    sessionName: "Session Alpha",
    projectName: "Project One",
    language: "zh",
    state: "Running",
    optionalFieldLines: ["模型 · gpt-5", "目录 · /tmp/project-one"],
    progressText: "正在整理运行摘要。",
    blockedReason: null,
    planEntries: ["1. 收敛实现边界", "2. 保持 Telegram UX"],
    planExpanded: true,
    agentEntries: inspect.agentSnapshot,
    agentsExpanded: false,
    includeFooter: true
  });
});

test("createRuntimeStatusControlsView keeps plan and agent controls in semantic form", () => {
  const inspect = createInspectSnapshot();

  const controls = createRuntimeStatusControlsView({
    sessionId: "session-1",
    language: "zh",
    inspect,
    planExpanded: false,
    agentsExpanded: true
  });

  assert.deepEqual(controls, {
    sessionId: "session-1",
    language: "zh",
    planEntries: ["1. 收敛实现边界", "2. 保持 Telegram UX"],
    planExpanded: false,
    agentEntries: inspect.agentSnapshot,
    agentsExpanded: true
  });
});
