export type SessionStatus = "idle" | "running" | "interrupted" | "failed";
export type SessionKind = "regular" | "side";

export type FailureReason =
  | "bridge_restart"
  | "app_server_lost"
  | "turn_failed"
  | "unknown";

export type RuntimeNoticeType =
  | "bridge_restart_recovery"
  | "side_restart_recovery"
  | "app_server_notice"
  | "terminal_delivery_deferred";

export type PendingInteractionKind =
  | "approval"
  | "permissions"
  | "questionnaire"
  | "elicitation";

export type PendingInteractionState =
  | "pending"
  | "awaiting_text"
  | "answered"
  | "canceled"
  | "expired"
  | "failed";

export type TerminalResultKind = "final_answer" | "plan_result";

export type TerminalDeliveryState = "pending" | "held_for_side" | "visible" | "deferred_notice_visible";
