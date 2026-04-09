import test from "node:test";
import assert from "node:assert/strict";

import {
  createStoredServerRequestId,
  deserializeServerRequestId,
  extractTerminalArtifactsFromTurnItems,
  getCompatibleSerializedRequestIds,
  parseAgentMessagePhase,
  readStoredServerRequestId,
  serializeServerRequestId,
  turnItemsContainCompactionTruth
} from "./protocol-truth.js";

test("server request id helpers preserve numeric and string round-trips with legacy compatibility", () => {
  assert.equal(serializeServerRequestId(7), "7");
  assert.equal(serializeServerRequestId("server-1"), "\"server-1\"");
  assert.equal(deserializeServerRequestId("7"), 7);
  assert.equal(deserializeServerRequestId("\"server-1\""), "server-1");
  assert.equal(deserializeServerRequestId("legacy-server-1"), "legacy-server-1");
  assert.deepEqual(
    getCompatibleSerializedRequestIds("legacy-server-1").sort(),
    ["\"legacy-server-1\"", "legacy-server-1"].sort()
  );
  assert.deepEqual(
    getCompatibleSerializedRequestIds("server-1").sort(),
    ["\"server-1\"", "server-1"].sort()
  );
  assert.deepEqual(
    getCompatibleSerializedRequestIds("7").sort(),
    ["\"7\"", "7"].sort()
  );
  assert.deepEqual(
    getCompatibleSerializedRequestIds(7),
    ["7"]
  );
});

test("stored server request ids preserve numeric-looking string boundaries", () => {
  assert.deepEqual(createStoredServerRequestId("7"), {
    value: "7",
    canonical: "\"7\"",
    legacy: "7",
    kind: "string"
  });
  assert.deepEqual(createStoredServerRequestId(7), {
    value: 7,
    canonical: "7",
    legacy: null,
    kind: "number"
  });

  assert.deepEqual(
    readStoredServerRequestId({
      requestIdText: "7",
      requestIdCanonical: "\"7\"",
      requestIdLegacy: "7",
      requestIdKind: "string"
    }),
    {
      value: "7",
      canonical: "\"7\"",
      legacy: "7",
      kind: "string"
    }
  );
  assert.deepEqual(
    readStoredServerRequestId({
      requestIdText: "7",
      requestIdCanonical: "7",
      requestIdLegacy: null,
      requestIdKind: "number"
    }),
    {
      value: 7,
      canonical: "7",
      legacy: null,
      kind: "number"
    }
  );
});

test("parseAgentMessagePhase accepts only authoritative phases", () => {
  assert.equal(parseAgentMessagePhase("commentary"), "commentary");
  assert.equal(parseAgentMessagePhase("final_answer"), "final_answer");
  assert.equal(parseAgentMessagePhase("other"), null);
  assert.equal(parseAgentMessagePhase(null), null);
});

test("extractTerminalArtifactsFromTurnItems prefers final_answer over commentary and trailing fallbacks", () => {
  const artifacts = extractTerminalArtifactsFromTurnItems([
    { type: "agentMessage", phase: "commentary", text: "thinking" },
    { type: "plan", text: "1. Do it" },
    { type: "agentMessage", phase: "final_answer", text: "done" },
    { type: "agentMessage", phase: null, text: "fallback" }
  ], {
    allowTrailingAgentMessage: true
  });

  assert.deepEqual(artifacts, {
    terminalMessage: "done",
    terminalMessageSource: "final_answer",
    proposedPlan: "1. Do it"
  });
});

test("extractTerminalArtifactsFromTurnItems falls back to trailing non-commentary messages and review exits", () => {
  assert.deepEqual(
    extractTerminalArtifactsFromTurnItems([
      { type: "agentMessage", phase: "commentary", text: "thinking" },
      { type: "agentMessage", text: "fallback" }
    ], {
      allowTrailingAgentMessage: true
    }),
    {
      terminalMessage: "fallback",
      terminalMessageSource: "agent_message",
      proposedPlan: null
    }
  );

  assert.deepEqual(
    extractTerminalArtifactsFromTurnItems([
      { type: "exitedReviewMode", review: "review result" }
    ]),
    {
      terminalMessage: "review result",
      terminalMessageSource: "review_exit",
      proposedPlan: null
    }
  );
});

test("turnItemsContainCompactionTruth recognizes modern compaction item types without relying on thread notifications", () => {
  assert.equal(turnItemsContainCompactionTruth([
    { type: "agentMessage", text: "commentary" },
    { type: "compaction" }
  ]), true);
  assert.equal(turnItemsContainCompactionTruth([
    { type: "contextCompaction" }
  ]), true);
  assert.equal(turnItemsContainCompactionTruth([
    { type: "agentMessage", text: "done" }
  ]), false);
});
