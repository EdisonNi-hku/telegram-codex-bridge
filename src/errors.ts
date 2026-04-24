export type BridgeErrorClassification = "transient" | "fatal" | "user_visible";

export class BridgeError extends Error {
  readonly classification: BridgeErrorClassification;

  constructor(message: string, classification: BridgeErrorClassification) {
    super(message);
    this.name = "BridgeError";
    this.classification = classification;
  }
}

export class TransientError extends BridgeError {
  constructor(message: string) {
    super(message, "transient");
    this.name = "TransientError";
  }
}

export class FatalError extends BridgeError {
  constructor(message: string) {
    super(message, "fatal");
    this.name = "FatalError";
  }
}

export class UserVisibleError extends BridgeError {
  constructor(message: string) {
    super(message, "user_visible");
    this.name = "UserVisibleError";
  }
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof BridgeError) {
    return error.classification === "transient";
  }
  return true;
}
