import test from "node:test";
import assert from "node:assert/strict";

import { extractFinalAnswerFromHistory, extractTurnArtifactsFromHistory } from "./turn-artifacts.js";

test("extractTurnArtifactsFromHistory prefers completed final_answer items and keeps proposed plans", async () => {
  const appServer = {
    resumeThread: async () => ({
      thread: {
        turns: [{
          id: "turn-1",
          status: "completed",
          items: [
            { type: "agentMessage", phase: "commentary", text: "thinking" },
            { type: "plan", text: "1. Audit\n2. Patch" },
            { type: "agentMessage", phase: "final_answer", text: "done" }
          ]
        }]
      }
    })
  } as any;

  const artifacts = await extractTurnArtifactsFromHistory(appServer, "thread-1", "turn-1");
  assert.deepEqual(artifacts, {
    finalMessage: "done",
    finalMessageSource: "final_answer",
    proposedPlan: "1. Audit\n2. Patch",
    compactionDetected: false,
    requestedTurnFound: true,
    usedReviewFallback: false,
    reviewArtifactsPresent: false,
    resolvedTurnId: "turn-1"
  });
});

test("extractFinalAnswerFromHistory falls back to review results when review artifacts are authoritative", async () => {
  const appServer = {
    resumeThread: async () => ({
      thread: {
        turns: [{
          id: "turn-review",
          status: "completed",
          items: [
            { type: "agentMessage", phase: "commentary", text: "thinking" },
            { type: "exitedReviewMode", review: "review result" }
          ]
        }]
      }
    })
  } as any;

  const finalMessage = await extractFinalAnswerFromHistory(appServer, "thread-1", "missing-turn");
  assert.equal(finalMessage, null);

  const artifacts = await extractTurnArtifactsFromHistory(appServer, "thread-1", "missing-turn", {
    allowReviewFallback: true
  });
  assert.equal(artifacts.finalMessage, "review result");
  assert.equal(artifacts.finalMessageSource, "review_exit");
  assert.equal(artifacts.usedReviewFallback, true);
  assert.equal(artifacts.compactionDetected, false);
});

test("extractTurnArtifactsFromHistory recognizes compaction truth from history items", async () => {
  const appServer = {
    resumeThread: async () => ({
      thread: {
        turns: [{
          id: "turn-compact",
          status: "completed",
          items: [
            { type: "compaction" },
            { type: "agentMessage", phase: "final_answer", text: "done" }
          ]
        }]
      }
    })
  } as any;

  const artifacts = await extractTurnArtifactsFromHistory(appServer, "thread-1", "turn-compact");
  assert.equal(artifacts.compactionDetected, true);
});
