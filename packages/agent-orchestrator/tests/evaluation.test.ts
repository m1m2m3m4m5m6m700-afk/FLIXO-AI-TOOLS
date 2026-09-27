import assert from "node:assert/strict";
import test from "node:test";
import { AgentEvaluationEngine } from "../src/evaluation.ts";
import { DEFAULT_AGENT_NETWORK } from "../src/network.ts";

test("evaluates evidence and awards reward only from measured criteria", () => {
  const engine = new AgentEvaluationEngine(DEFAULT_AGENT_NETWORK);
  const result = engine.evaluate(
    {
      id: "tester-001",
      agentId: "tester",
      objective: "verify a change",
      constraints: [],
      criteria: [
        { id: "tests", description: "tests pass", weight: 0.7 },
        { id: "artifacts", description: "required artifacts exist", weight: 0.3 },
      ],
    },
    {
      testsPassed: 10,
      testsFailed: 0,
      requiredArtifacts: ["report"],
      completedArtifacts: ["report"],
    },
  );
  assert.equal(result.score, 100);
  assert.equal(result.passed, true);
  assert.ok(engine.profile("tester").rewardBalance > 0);
  assert.equal(engine.rewardLedger()[0].reason, "evaluation-passed");
});

test("failed evidence earns only partial reward", () => {
  const engine = new AgentEvaluationEngine(DEFAULT_AGENT_NETWORK);
  const result = engine.evaluate(
    {
      id: "security-001",
      agentId: "security",
      objective: "review security",
      constraints: [],
      criteria: [{ id: "review", description: "no findings", weight: 1 }],
    },
    { reviewFindings: 10 },
  );
  assert.equal(result.score, 0);
  assert.equal(result.passed, false);
  assert.ok(engine.profile("security").rewardBalance < 25);
});
