import test from "node:test";
import assert from "node:assert/strict";

import type { PersistedInteractionRecord } from "../domain/records.js";
import type {
  NormalizedApprovalInteraction,
  NormalizedPermissionsInteraction,
  NormalizedQuestionnaireInteraction
} from "../../interactions/normalize.js";
import { createInteractionCardView } from "./interaction-workflow.js";

function createPendingInteractionRow(
  overrides: Partial<PersistedInteractionRecord> = {}
): PersistedInteractionRecord {
  return {
    interactionId: overrides.interactionId ?? "ix-1",
    state: overrides.state ?? "pending",
    responseJson: "responseJson" in overrides ? overrides.responseJson ?? null : null,
    errorReason: "errorReason" in overrides ? overrides.errorReason ?? null : null
  };
}

function createApprovalInteraction(
  overrides: Partial<NormalizedApprovalInteraction> = {}
): NormalizedApprovalInteraction {
  return {
    kind: "approval",
    method: "item/commandExecution/requestApproval",
    threadId: overrides.threadId ?? "thread-1",
    turnId: overrides.turnId ?? "turn-1",
    rawParams: overrides.rawParams ?? {},
    itemId: overrides.itemId ?? "item-1",
    approvalId: overrides.approvalId ?? "approval-1",
    decisionOptions: overrides.decisionOptions ?? [
      { key: "accept", kind: "accept", label: "批准", payload: { decision: "accept" } },
      { key: "acceptForSession", kind: "acceptForSession", label: "本会话内总是批准", payload: { decision: "acceptForSession" } },
      { key: "decline", kind: "decline", label: "拒绝", payload: { decision: "decline" } },
      { key: "cancel", kind: "cancel", label: "取消", payload: { decision: "cancel" } }
    ],
    title: overrides.title ?? "Codex 需要命令批准",
    subtitle: overrides.subtitle ?? "命令审批",
    body: overrides.body ?? "pnpm test",
    detail: overrides.detail ?? "需要网络访问"
  };
}

function createQuestionnaireInteraction(
  overrides: Partial<NormalizedQuestionnaireInteraction> = {}
): NormalizedQuestionnaireInteraction {
  return {
    kind: "questionnaire",
    method: "item/tool/requestUserInput",
    threadId: overrides.threadId ?? "thread-1",
    turnId: overrides.turnId ?? "turn-1",
    rawParams: overrides.rawParams ?? {},
    itemId: overrides.itemId ?? "item-1",
    title: overrides.title ?? "Codex 需要更多信息",
    submission: overrides.submission ?? "tool_request_user_input",
    serverName: overrides.serverName ?? null,
    questions: overrides.questions ?? [
      {
        id: "env",
        header: "环境",
        question: "部署到哪个环境？",
        options: [
          { value: "staging", label: "staging", description: "共享测试环境" },
          { value: "prod", label: "prod", description: "生产环境" }
        ],
        isOther: true,
        isSecret: false,
        required: true,
        answerFormat: "string",
        allowedValues: ["staging", "prod"]
      },
      {
        id: "notes",
        header: "备注",
        question: "补充说明",
        options: null,
        isOther: false,
        isSecret: true,
        required: false,
        answerFormat: "string",
        allowedValues: null
      }
    ]
  };
}

function createPermissionsInteraction(
  overrides: Partial<NormalizedPermissionsInteraction> = {}
): NormalizedPermissionsInteraction {
  return {
    kind: "permissions",
    method: "item/permissions/requestApproval",
    threadId: overrides.threadId ?? "thread-1",
    turnId: overrides.turnId ?? "turn-1",
    rawParams: overrides.rawParams ?? {},
    itemId: overrides.itemId ?? "item-1",
    requestedPermissions: overrides.requestedPermissions ?? {
      fileSystem: {
        read: ["/tmp/project-one"],
        write: ["/tmp/project-one"]
      }
    },
    title: overrides.title ?? "Codex 需要权限批准",
    subtitle: overrides.subtitle ?? "权限审批",
    detail: overrides.detail ?? "需要访问工作区"
  };
}

test("createInteractionCardView returns a semantic approval view without Telegram markup", () => {
  const view = createInteractionCardView(
    createPendingInteractionRow(),
    createApprovalInteraction(),
    { hubHint: "如需查看或刷新 Hub，可发送 /hub。" }
  );

  assert.deepEqual(view, {
    kind: "approval",
    interactionId: "ix-1",
    title: "Codex 需要命令批准",
    subtitle: "命令审批",
    body: "pnpm test",
    detail: "需要网络访问",
    hubHint: "如需查看或刷新 Hub，可发送 /hub。",
    actions: [
      { text: "批准", decisionKey: "accept" },
      { text: "本会话内总是批准", decisionKey: "acceptForSession" },
      { text: "拒绝", decisionKey: "decline" }
    ]
  });
});

test("createInteractionCardView returns a semantic questionnaire view while awaiting text", () => {
  const view = createInteractionCardView(
    createPendingInteractionRow({
      interactionId: "ix-question",
      state: "awaiting_text",
      responseJson: JSON.stringify({
        answers: {},
        awaitingQuestionId: "notes"
      })
    }),
    createQuestionnaireInteraction()
  );

  assert.deepEqual(view, {
    kind: "question",
    interactionId: "ix-question",
    title: "Codex 需要更多信息",
    questionId: "notes",
    header: "备注",
    question: "补充说明",
    questionIndex: 2,
    totalQuestions: 2,
    options: null,
    isOther: false,
    isSecret: true,
    awaitingText: true,
    hubHint: null
  });
});

test("createInteractionCardView returns semantic answered details for questionnaire responses", () => {
  const view = createInteractionCardView(
    createPendingInteractionRow({
      interactionId: "ix-answered",
      state: "answered",
      responseJson: JSON.stringify({
        answers: {
          env: { answers: ["prod"] },
          notes: { answers: ["只在窗口期执行"] }
        }
      })
    }),
    createQuestionnaireInteraction(),
    { answeredExpanded: true, hubHint: "如需查看或刷新 Hub，可发送 /hub。" }
  );

  assert.deepEqual(view, {
    kind: "resolved",
    title: "Codex 需要更多信息",
    state: "answered",
    summary: "Codex 需要更多信息 / 环境: prod / 备注: 已提交敏感回答，不显示内容",
    details: [
      "1. 环境",
      "问题：部署到哪个环境？",
      "回答：prod",
      "2. 备注",
      "问题：补充说明",
      "回答：已提交敏感回答，不显示内容"
    ],
    expandable: true,
    expanded: true,
    interactionId: "ix-answered",
    hubHint: "如需查看或刷新 Hub，可发送 /hub。"
  });
});

test("createInteractionCardView preserves declined permissions summaries", () => {
  const view = createInteractionCardView(
    createPendingInteractionRow({
      interactionId: "ix-permissions",
      state: "answered",
      responseJson: JSON.stringify({
        scope: "turn"
      })
    }),
    createPermissionsInteraction()
  );

  assert.deepEqual(view, {
    kind: "resolved",
    title: "Codex 需要权限批准",
    state: "answered",
    summary: "已拒绝（turn）",
    details: [],
    expandable: false,
    expanded: false,
    interactionId: "ix-permissions",
    hubHint: null
  });
});

test("createInteractionCardView preserves MCP form submission summaries", () => {
  const view = createInteractionCardView(
    createPendingInteractionRow({
      interactionId: "ix-mcp-form",
      state: "answered",
      responseJson: JSON.stringify({
        action: "accept",
        content: {
          server: "db",
          environment: "prod",
          region: "us-east-1",
          secret: "masked"
        }
      })
    }),
    createQuestionnaireInteraction({
      title: "MCP 需要更多信息",
      method: "mcpServer/elicitation/request",
      submission: "mcp_elicitation_form",
      serverName: "db-server"
    })
  );

  assert.deepEqual(view, {
    kind: "resolved",
    title: "MCP 需要更多信息",
    state: "answered",
    summary: "已提交 4 个字段",
    details: [],
    expandable: false,
    expanded: false,
    interactionId: "ix-mcp-form",
    hubHint: null
  });
});

test("createInteractionCardView returns semantic terminal views for failed or expired interactions", () => {
  const failed = createInteractionCardView(
    createPendingInteractionRow({
      interactionId: "ix-failed",
      state: "failed",
      errorReason: "interaction_delivery_failed"
    }),
    createApprovalInteraction()
  );
  const expired = createInteractionCardView(
    createPendingInteractionRow({
      interactionId: "ix-expired",
      state: "expired",
      errorReason: "turn_completed"
    }),
    createApprovalInteraction({ title: "Codex 需要更多信息" })
  );

  assert.deepEqual(failed, {
    kind: "resolved",
    title: "Codex 需要命令批准",
    state: "failed",
    summary: "当前控制面未能送达这条交互。",
    details: [],
    expandable: false,
    expanded: false,
    hubHint: null
  });
  assert.deepEqual(expired, {
    kind: "expired",
    title: "Codex 需要更多信息",
    reason: "当前操作已结束，交互已失效。"
  });
});
