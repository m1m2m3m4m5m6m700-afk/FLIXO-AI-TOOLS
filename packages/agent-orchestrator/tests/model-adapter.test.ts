import assert from "node:assert/strict";
import test from "node:test";
import { createModelBackedWorker } from "../src/model-adapter.ts";

test("model-backed worker turns an invoker into a supervised worker", async () => {
  const worker = createModelBackedWorker(
    { id: "implementer", role: "implementer" },
    {
      invoker: {
        async invoke(request) {
          assert.equal(request.profile.role, "implementer");
          assert.equal(request.turn, 1);
          return { content: "implemented with verified test evidence", evidence: { testsPassed: 3 } };
        },
      },
    },
  );
  const report = await worker.run({
    stepId: "step-1",
    commandId: "cmd-1",
    role: "implementer",
    objective: "Implement the feature",
    constraints: ["direct-command-only"],
    context: Object.freeze({}),
  });
  assert.equal(report.status, "completed");
  assert.equal(report.commandId, "cmd-1");
  assert.deepEqual(report.evidence, { testsPassed: 3 });
});

test("unknown roles cannot obtain a model profile", async () => {
  const worker = createModelBackedWorker(
    { id: "unknown", role: "unknown" },
    { invoker: { async invoke() { return { content: "x" }; } } },
  );
  await assert.rejects(() => worker.run({
    stepId: "step-1",
    commandId: "cmd-1",
    role: "unknown",
    objective: "x",
    constraints: [],
    context: Object.freeze({}),
  }), /AGENT_MODEL_PROFILE_NOT_FOUND/);
});
