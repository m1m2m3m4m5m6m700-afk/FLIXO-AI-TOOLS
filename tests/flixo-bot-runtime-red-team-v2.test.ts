import assert from "node:assert/strict";
import test from "node:test";
import {
  createFlixoBotRunState,
  recordToolCall,
  restoreFlixoBotRunState,
  startRun,
  type FlixoBotRunState,
  type FlixoBotRestoreTrustBoundary,
} from "../src/lib/agent/flixo-bot-openai-runtime.ts";

const sha = "a".repeat(40);
const trustBoundary: FlixoBotRestoreTrustBoundary = {
  agentId: "execution-agent-clone-v1",
  maxTurns: 24,
  maxRetries: 3,
  maxToolCalls: 8,
};

function restore(state: FlixoBotRunState): FlixoBotRunState {
  return restoreFlixoBotRunState(JSON.stringify(state), sha, trustBoundary);
}

function runningState(): FlixoBotRunState {
  let state = createFlixoBotRunState({
    taskId: "task-red-v2",
    agentId: "execution-agent-clone-v1",
    exactSha: sha,
    request: "test",
  });
  state = startRun(state, sha);
  return state;
}

test("runtime rejects non-owner tool calls without mutating the run", () => {
  const state = runningState();
  assert.throws(
    () => recordToolCall(
      state,
      sha,
      {
        toolId: "image-compressor",
        callId: "call-owner-mismatch",
        actorId: "attacker-agent",
        branch: "execution",
        exactSha: sha,
        expectedSha: sha,
        mutation: false,
        certification: false,
        requiresApproval: false,
      },
      { mutationAuthority: false, certificationAuthority: false },
    ),
    /FLIXO_BOT_TOOL_OWNER_MISMATCH/,
  );
  assert.equal(state.status, "RUNNING");
  assert.equal(state.toolCallCount, 0);
});

test("runtime restore rejects inflated execution budgets and malformed state", () => {
  const state = runningState();
  const inflated = { ...state, status: "WAITING_APPROVAL", maxToolCalls: 999_999 };
  assert.throws(
    () => restoreFlixoBotRunState(JSON.stringify(inflated), sha, trustBoundary),
    /FLIXO_BOT_RUN_TOOL_BUDGET_INVALID/,
  );

  assert.throws(
    () => restoreFlixoBotRunState("{bad-json", sha, trustBoundary),
    /FLIXO_BOT_RUN_STATE_INVALID_JSON/,
  );
});

test("runtime restore keeps valid bounded state intact", () => {
  const state = runningState();
  const restored = restore(state);
  assert.equal(restored.runId, state.runId);
  assert.equal(restored.maxToolCalls, state.maxToolCalls);
  assert.equal(restored.events.length, state.events.length);
});


test("runtime restore fails closed on missing events, invalid status, and oversized payloads", () => {
  const state = runningState();
  assert.throws(
    () => restoreFlixoBotRunState(JSON.stringify({ ...state, events: undefined }), sha, trustBoundary),
    /FLIXO_BOT_RUN_EVENTS_INVALID/,
  );
  assert.throws(
    () => restoreFlixoBotRunState(JSON.stringify({ ...state, status: "IMAGINARY" }), sha, trustBoundary),
    /FLIXO_BOT_RUN_STATUS_INVALID/,
  );
  assert.throws(
    () => restoreFlixoBotRunState("x".repeat(256_001), sha, trustBoundary),
    /FLIXO_BOT_RUN_SERIALIZED_STATE_INVALID/,
  );
});

test("runtime handoff does not transfer execution authority implicitly", async () => {
  const { applyNextStep } = await import("../src/lib/agent/flixo-bot-openai-runtime.ts");
  const state = runningState();
  const next = applyNextStep(state, sha, {
    type: "HANDOFF",
    targetAgentId: "attacker-agent",
    reason: "requested handoff",
  });
  assert.equal(next.currentOwner, state.currentOwner);
  assert.equal(next.currentOwner, "execution-agent-clone-v1");
  const handoff = next.events.at(-1);
  assert.equal(handoff?.type, "HANDOFF");
  assert.equal((handoff?.detail as { authorityTransferred?: boolean } | undefined)?.authorityTransferred, false);
});

test("runtime restore rejects owner tampering even with a current SHA", () => {
  const state = runningState();
  const tampered = {
    ...state,
    currentOwner: "attacker-agent",
    status: "WAITING_APPROVAL" as const,
  };
  assert.throws(
    () => restoreFlixoBotRunState(JSON.stringify(tampered), sha, trustBoundary),
    /FLIXO_BOT_RUN_OWNER_TRUST_BOUNDARY_VIOLATION/,
  );
});
