import type { PendingInteractionRow } from "../../types.js";
import type {
  NormalizedApprovalInteraction,
  NormalizedInteraction,
  NormalizedQuestion,
  NormalizedQuestionnaireInteraction
} from "../../interactions/normalize.js";
import { asRecord, getString, getStringArray } from "../../util/untyped.js";
import type { InteractionCardView } from "../interaction-model/interaction.js";

interface QuestionnaireDraft {
  answers: Record<string, unknown>;
  awaitingQuestionId?: string | null;
}

type InteractionWorkflowRow = Pick<
  PendingInteractionRow,
  "interactionId" | "state" | "responseJson" | "errorReason"
>;

export function createInteractionCardView(
  row: InteractionWorkflowRow,
  interaction: NormalizedInteraction,
  options?: {
    answeredExpanded?: boolean;
    hubHint?: string | null;
  }
): InteractionCardView {
  const hubHint = options?.hubHint ?? null;

  if (row.state === "answered") {
    const details = buildAnsweredInteractionDetails(row, interaction);
    return {
      kind: "resolved",
      title: interaction.title,
      state: "answered",
      summary: summarizeAnsweredInteractionForSurface(row, interaction),
      details,
      expandable: details.length > 0,
      expanded: options?.answeredExpanded ?? false,
      interactionId: row.interactionId,
      hubHint
    };
  }

  if (row.state === "canceled") {
    return {
      kind: "resolved",
      title: interaction.title,
      state: "canceled",
      summary: "已取消",
      details: [],
      expandable: false,
      expanded: false,
      ...(hubHint ? { hubHint } : {})
    };
  }

  if (row.state === "failed") {
    return {
      kind: "resolved",
      title: interaction.title,
      state: "failed",
      summary: formatPendingInteractionTerminalReason(row.errorReason),
      details: [],
      expandable: false,
      expanded: false,
      hubHint: null
    };
  }

  if (row.state === "expired") {
    return {
      kind: "expired",
      title: interaction.title,
      reason: formatPendingInteractionTerminalReason(row.errorReason)
    };
  }

  switch (interaction.kind) {
    case "approval":
      return {
        kind: "approval",
        interactionId: row.interactionId,
        title: interaction.title,
        subtitle: interaction.subtitle,
        body: interaction.body,
        detail: interaction.detail,
        hubHint,
        actions: buildApprovalActions(interaction)
      };
    case "permissions":
      return {
        kind: "approval",
        interactionId: row.interactionId,
        title: interaction.title,
        subtitle: interaction.subtitle,
        body: summarizePermissions(interaction.requestedPermissions),
        detail: interaction.detail,
        hubHint,
        actions: [
          { text: "批准本次权限", decisionKey: "accept" },
          { text: "本会话内总是批准", decisionKey: "acceptForSession" },
          { text: "拒绝", decisionKey: "decline" }
        ]
      };
    case "elicitation":
      return {
        kind: "approval",
        interactionId: row.interactionId,
        title: interaction.title,
        subtitle: `MCP: ${interaction.serverName}`,
        body: interaction.message,
        detail: interaction.detail,
        hubHint,
        actions: [
          { text: "接受", decisionKey: "accept" },
          { text: "拒绝", decisionKey: "decline" }
        ]
      };
    case "questionnaire": {
      const draft = parseQuestionnaireDraft(row.responseJson);
      const currentQuestion = getCurrentQuestion(interaction, draft);
      if (!currentQuestion) {
        return {
          kind: "resolved",
          title: interaction.title,
          state: "answered",
          summary: summarizeAnsweredInteractionForSurface(row, interaction),
          details: [],
          expandable: false,
          expanded: false,
          ...(hubHint ? { hubHint } : {})
        };
      }

      return {
        kind: "question",
        interactionId: row.interactionId,
        title: interaction.title,
        questionId: currentQuestion.id,
        header: currentQuestion.header,
        question: currentQuestion.question,
        questionIndex: findQuestionIndex(interaction, currentQuestion.id) + 1,
        totalQuestions: interaction.questions.length,
        options: currentQuestion.options?.map((option) => ({
          label: option.label,
          description: option.description
        })) ?? null,
        isOther: currentQuestion.isOther,
        isSecret: currentQuestion.isSecret,
        awaitingText: row.state === "awaiting_text",
        hubHint
      };
    }
  }
}

function buildApprovalActions(interaction: NormalizedApprovalInteraction): Array<{ text: string; decisionKey: string }> {
  return interaction.decisionOptions
    .filter((option) => option.kind !== "cancel")
    .map((option) => ({
      decisionKey: option.key,
      text: option.label
    }));
}

function buildAnsweredInteractionDetails(
  row: InteractionWorkflowRow,
  interaction: NormalizedInteraction
): string[] {
  if (interaction.kind !== "questionnaire") {
    return [];
  }

  const details: string[] = [];
  const payload = parseJsonRecord(row.responseJson);
  const answers = parseJsonRecord(payload?.answers);
  if (!answers) {
    return [];
  }

  for (const [index, question] of interaction.questions.entries()) {
    const answerRecord = parseJsonRecord(answers[question.id]);
    const answerList = extractAnsweredInteractionValues(answerRecord);
    if (!answerList) {
      continue;
    }

    details.push(`${index + 1}. ${question.header}`);
    details.push(`问题：${question.question}`);
    details.push(`回答：${question.isSecret ? "已提交敏感回答，不显示内容" : answerList.join("，")}`);
  }

  return details;
}

function summarizeAnsweredInteractionForSurface(
  row: InteractionWorkflowRow,
  interaction: NormalizedInteraction
): string | null {
  if (interaction.kind !== "questionnaire") {
    return summarizeAnsweredInteraction(row, interaction);
  }

  const payload = parseJsonRecord(row.responseJson);
  const answers = parseJsonRecord(payload?.answers);
  if (!answers) {
    return summarizeAnsweredInteraction(row, interaction);
  }

  const segments = interaction.questions
    .map((question) => {
      const answerRecord = parseJsonRecord(answers[question.id]);
      const answerList = extractAnsweredInteractionValues(answerRecord);
      if (!answerList) {
        return null;
      }

      const answerText = question.isSecret ? "已提交敏感回答，不显示内容" : answerList.join("，");
      return `${question.header}: ${answerText}`;
    })
    .filter((value): value is string => Boolean(value));

  if (segments.length === 0) {
    return summarizeAnsweredInteraction(row, interaction);
  }

  return `${interaction.title} / ${segments.join(" / ")}`;
}

function summarizeAnsweredInteraction(
  row: InteractionWorkflowRow,
  interaction: NormalizedInteraction
): string | null {
  const payload = parseJsonRecord(row.responseJson);
  switch (interaction.kind) {
    case "approval": {
      const decisionRecord = asRecord(payload?.decision);
      if (decisionRecord?.acceptWithExecpolicyAmendment) {
        return "已批准，并更新命令规则";
      }
      if (decisionRecord?.applyNetworkPolicyAmendment) {
        const networkDecision = asRecord(decisionRecord.applyNetworkPolicyAmendment);
        const amendment = asRecord(networkDecision?.network_policy_amendment);
        const host = typeof amendment?.host === "string" ? amendment.host : null;
        return host ? `已批准，并保存网络规则（${host}）` : "已批准，并保存网络规则";
      }

      const decision = typeof payload?.decision === "string" ? payload.decision : null;
      if (decision === "accept" || decision === "approved") {
        return "已批准";
      }
      if (decision === "acceptForSession" || decision === "approved_for_session") {
        return "已批准，并写入本会话缓存";
      }
      if (decision === "decline" || decision === "denied") {
        return "已拒绝";
      }
      if (decision === "cancel" || decision === "abort") {
        return "已取消";
      }
      return "已处理";
    }
    case "permissions": {
      const scope = typeof payload?.scope === "string" ? payload.scope : "turn";
      const granted = summarizeGrantedPermissions(payload?.permissions ?? null);
      return granted ? `已授权（${scope}）: ${granted}` : `已拒绝（${scope}）`;
    }
    case "elicitation": {
      const action = typeof payload?.action === "string" ? payload.action : null;
      return action === "accept" ? "已接受" : action === "decline" ? "已拒绝" : action === "cancel" ? "已取消" : "已处理";
    }
    case "questionnaire": {
      const action = typeof payload?.action === "string" ? payload.action : null;
      if (action === "cancel") {
        return "已取消";
      }
      if (action === "decline") {
        return "已拒绝";
      }
      if (action === "accept") {
        const content = parseJsonRecord(payload?.content);
        const count = content ? Object.keys(content).length : 0;
        return count > 0 ? `已提交 ${count} 个字段` : "已提交表单";
      }

      const answers = parseJsonRecord(payload?.answers);
      const count = answers ? Object.keys(answers).length : 0;
      return count > 0 ? `已提交 ${count} 个回答` : "已提交回答";
    }
  }
}

function summarizePermissions(value: unknown): string | null {
  const parts = collectPermissionSummaryParts(value);
  return parts.length > 0 ? parts.join("；") : "无额外权限";
}

function summarizeGrantedPermissions(value: unknown): string | null {
  const parts = collectPermissionSummaryParts(value);
  return parts.length > 0 ? parts.join("；") : null;
}

function collectPermissionSummaryParts(value: unknown): string[] {
  const record = parseJsonRecord(value);
  if (!record) {
    return [];
  }

  const parts: string[] = [];
  const fileSystem = parseJsonRecord(record.fileSystem);
  if (fileSystem) {
    const read = Array.isArray(fileSystem.read) ? fileSystem.read.length : 0;
    const write = Array.isArray(fileSystem.write) ? fileSystem.write.length : 0;
    if (read > 0 || write > 0) {
      parts.push(`文件系统 读${read}/写${write}`);
    }
  }

  const network = parseJsonRecord(record.network);
  if (network?.enabled === true) {
    parts.push("网络");
  }

  const macos = parseJsonRecord(record.macos);
  if (macos) {
    parts.push("macOS 权限");
  }

  return parts;
}

function formatPendingInteractionTerminalReason(reason: string | null | undefined): string | null {
  switch (reason) {
    case "app_server_lost":
      return "Codex 服务已断开，这个交互无法继续。";
    case "bridge_restart":
      return "桥接服务已重启，这个交互无法继续。";
    case "response_dispatch_failed":
      return "Codex 服务没有收到这次交互结果。";
    case "turn_completed":
    case "turn_failed":
    case "turn_interrupted":
      return "当前操作已结束，交互已失效。";
    case "telegram_delivery_failed":
      return "Telegram 未能发送这张交互卡片。";
    default:
      return reason ? "这个交互无法继续。" : null;
  }
}

function parseQuestionnaireDraft(responseJson: string | null): QuestionnaireDraft {
  if (!responseJson) {
    return { answers: {} };
  }

  try {
    const parsed = asRecord(JSON.parse(responseJson));
    return {
      answers: asRecord(parsed?.answers) ?? {},
      awaitingQuestionId: getString(parsed, "awaitingQuestionId")
    };
  } catch {
    return { answers: {} };
  }
}

function getCurrentQuestion(
  interaction: NormalizedQuestionnaireInteraction,
  draft: QuestionnaireDraft
): NormalizedQuestion | null {
  if (draft.awaitingQuestionId) {
    return interaction.questions.find((question) => question.id === draft.awaitingQuestionId) ?? null;
  }

  return interaction.questions.find((question) => !hasDraftAnswer(draft, question.id)) ?? null;
}

function findQuestionIndex(interaction: NormalizedQuestionnaireInteraction, questionId: string): number {
  return Math.max(0, interaction.questions.findIndex((question) => question.id === questionId));
}

function hasDraftAnswer(draft: QuestionnaireDraft, questionId: string): boolean {
  return Object.prototype.hasOwnProperty.call(draft.answers, questionId);
}

function extractAnsweredInteractionValues(record: Record<string, unknown> | null): string[] | null {
  if (!record) {
    return null;
  }

  const answers = getStringArray(record, "answers");
  return answers.length > 0 ? answers : null;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return parseJsonRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return asRecord(value);
}
