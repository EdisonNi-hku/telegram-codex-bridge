import test from "node:test";
import assert from "node:assert/strict";

import type { ReadinessSnapshot } from "../../types.js";
import {
  applyFeishuSetupObservation,
  applyFeishuSetupToSnapshot,
  FEISHU_SETUP_CHECKLIST,
  resetFeishuSetupCycle
} from "./setup.js";

function createSnapshot(overrides: Partial<ReadinessSnapshot> = {}): ReadinessSnapshot {
  return {
    state: "ready",
    checkedAt: "2026-04-09T00:00:00.000Z",
    details: {
      activePack: "feishu",
      codexInstalled: true,
      codexAuthenticated: true,
      appServerAvailable: true,
      packState: "ready",
      setupState: "incomplete",
      authorizedUserBound: true,
      issues: [],
      sharedIssues: [],
      packIssues: [],
      packChecks: [{
        id: "feishu_authorization_binding",
        ok: true,
        summary: "feishu authorization is bound"
      }],
      packMetadata: {
        feishuAppId: "cli_test"
      },
      ...(overrides.details ?? {})
    },
    appServerPid: null,
    ...overrides
  };
}

test("feishu setup remains incomplete until text, interactive send, and callback are all observed", () => {
  const base = applyFeishuSetupToSnapshot(createSnapshot());
  assert.equal(base.details.setupState, "incomplete");
  assert.match((base.details.packIssues ?? []).join("\n"), /text ingress has not been observed/u);

  const withText = applyFeishuSetupObservation(base, {
    lastTextIngressAt: "2026-04-09T00:01:00.000Z"
  }, "2026-04-09T00:01:00.000Z");
  assert.equal(withText.details.setupState, "incomplete");

  const withInteractive = applyFeishuSetupObservation(withText, {
    lastInteractiveCardSentAt: "2026-04-09T00:02:00.000Z"
  }, "2026-04-09T00:02:00.000Z");
  assert.equal(withInteractive.details.setupState, "incomplete");

  const completed = applyFeishuSetupObservation(withInteractive, {
    lastCardCallbackAt: "2026-04-09T00:03:00.000Z"
  }, "2026-04-09T00:03:00.000Z");
  assert.equal(completed.details.setupState, "complete");
  assert.deepEqual(completed.details.packIssues, []);
});

test("resetFeishuSetupCycle clears previous Feishu observations", () => {
  const snapshot = applyFeishuSetupObservation(createSnapshot(), {
    lastTextIngressAt: "2026-04-09T00:01:00.000Z",
    lastInteractiveCardSentAt: "2026-04-09T00:02:00.000Z",
    lastCardCallbackAt: "2026-04-09T00:03:00.000Z"
  }, "2026-04-09T00:03:00.000Z");

  const reset = resetFeishuSetupCycle(snapshot, "2026-04-09T00:04:00.000Z");
  assert.equal(reset.details.setupState, "incomplete");
  assert.equal(reset.details.packMetadata?.feishuLastTextIngressAt, null);
  assert.equal(reset.details.packMetadata?.feishuLastInteractiveCardSentAt, null);
  assert.equal(reset.details.packMetadata?.feishuLastCardCallbackAt, null);
});

test("feishu setup checklist includes upload scopes for file sending", () => {
  assert.ok(FEISHU_SETUP_CHECKLIST.includes("grant im:resource:upload or im:resource for file and image upload"));
});
