import assert from "node:assert/strict";
import test from "node:test";
import { AgentEvaluationEngine, AGENT_TRAINING_CASES } from "../src/evaluation.ts";
import { DEFAULT_AGENT_NETWORK } from "../src/network.ts";

test("all ten agents have benchmark training cases", () => {
  const engine = new AgentEvaluationEngine(DEFAULT_AGENT_NETWORK);
  assert.equal(AGENT_TRAINING_CASES.length, 10);
  for (const agent of DEFAULT_AGENT_NETWORK) assert.equal(engine.benchmark(agent.id).agentId, agent.id);
});

test("measured success awards XP, rewards, and trust", () => {
  const engine = new AgentEvaluationEngine(DEFAULT_AGENT_NETWORK);
  const result = engine.evaluate(engine.benchmark("tester"), {
    testsPassed: 10, testsFailed: 0, requiredArtifacts: ["report"], completedArtifacts: ["report"],
    reviewFindings: 0, evidenceVerified: true,
  });
  assert.equal(result.score, 100);
  assert.equal(result.passed, true);
  const profile = engine.profile("tester");
  assert.ok(profile.xp > 0 && profile.rewardBalance > 0 && profile.trustScore > 50);
});

test("out-of-scope execution is penalized and cannot earn full reward", () => {
  const engine = new AgentEvaluationEngine(DEFAULT_AGENT_NETWORK);
  const result = engine.evaluate(engine.benchmark("implementer"), {
    testsPassed: 10, testsFailed: 0, requiredArtifacts: ["code"], completedArtifacts: ["code"],
    reviewFindings: 0, outOfScopeActions: 1,
  });
  assert.equal(result.passed, false);
  assert.equal(engine.rewardLedger()[0].reason, "policy-penalty");
  assert.equal(engine.profile("implementer").trustScore, 35);
});
