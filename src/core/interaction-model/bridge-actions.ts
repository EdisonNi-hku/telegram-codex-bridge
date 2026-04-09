export type BridgeCommandAction =
  | "cancel"
  | "hub"
  | "status"
  | "inspect"
  | "interrupt"
  | "commands";

export interface BridgeCommandActionView {
  command: BridgeCommandAction;
  style?: "default" | "primary";
}
