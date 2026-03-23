import type { InteractionRef } from "../domain/context.js";

export interface InteractionActionView {
  text: string;
  decisionKey: string;
}

export interface InteractionApprovalCardView extends InteractionRef {
  kind: "approval";
  title: string;
  subtitle: string;
  body?: string | null;
  detail?: string | null;
  hubHint?: string | null;
  actions: InteractionActionView[];
}

export interface InteractionQuestionOptionView {
  label: string;
  description: string;
}

export interface InteractionQuestionCardView extends InteractionRef {
  kind: "question";
  title: string;
  questionId: string;
  header: string;
  question: string;
  questionIndex: number;
  totalQuestions: number;
  options: InteractionQuestionOptionView[] | null;
  isOther: boolean;
  isSecret: boolean;
  awaitingText?: boolean;
  hubHint?: string | null;
}

export interface InteractionResolvedCardView {
  kind: "resolved";
  title: string;
  state: "answered" | "canceled" | "failed";
  summary?: string | null;
  details?: string[];
  expandable?: boolean;
  expanded?: boolean;
  interactionId?: string;
  hubHint?: string | null;
}

export interface InteractionExpiredCardView {
  kind: "expired";
  title: string;
  reason?: string | null;
}

export type InteractionCardView =
  | InteractionApprovalCardView
  | InteractionQuestionCardView
  | InteractionResolvedCardView
  | InteractionExpiredCardView;
