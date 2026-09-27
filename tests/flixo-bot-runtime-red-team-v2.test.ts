import assert from "node:assert/strict";
import test from "node:test";
import {
  createFlixoBotRunState,
  recordToolCall,
  restoreFlixoBotRunState,
  startRun,
  type FlixoBotRunState,
} from "../src/lib/agent/flixo-bot-openai-runtime.ts";

const sha = "a".repeat(40);

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

test("runtime blocks tool calls from a non-owner actor", () => {
  const result = recordToolCall(
    runningState(),
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
  );

  assert.equal(result.decision.allowed, false);
  assert.equal(result.decision.reason, "OWNER_REQUIRED");
  assert.equal(result.state.status, "BLOCKED");
});

test("runtime restore rejects inflated execution budgets and malformed state", () => {
  const state = runningState();
  const inflated = { ...state, status: "WAITING_APPROVAL", maxToolCalls: 999_999 };
  assert.throws(
    () => restoreFlixoBotRunState(JSON.stringify(inflated), sha),
    /FLIXO_BOT_RUN_TOOL_BUDGET_INVALID/,
  );

  assert.throws(
    () => restoreFlixoBotRunState("{bad-json", sha),
    /FLIXO_BOT_RUN_STATE_INVALID_JSON/,
  );
});

test("runtime restore keeps valid bounded state intact", () => {
  const state = runningState();
  const restored = restoreFlixoBotRunState(JSON.stringify(state), sha);
  assert.equal(restored.runId, state.runId);
  assert.equal(restored.maxToolCalls, state.maxToolCalls);
  assert.equal(restored.events.length, state.events.length);
});
