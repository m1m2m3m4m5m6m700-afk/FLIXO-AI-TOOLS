import assert from "node:assert/strict";
import test from "node:test";
import { AgentRewardEngine, REWARD_WEIGHTS } from "../src/reward.ts";

test("reward engine uses the six-dimensional reward contract", () => {
  assert.equal(Object.values(REWARD_WEIGHTS).reduce((a, b) => a + b, 0), 1);
  const result = new AgentRewardEngine().calculate({
    testsPassed: 10, testsFailed: 0,
    requiredArtifacts: ["code"], completedArtifacts: ["code"], evidenceVerified: true,
  });
  assert.equal(result.score, 100);
  assert.equal(result.penalty, 0);
});

test("reward engine penalizes reward hacking signals", () => {
  const result = new AgentRewardEngine().calculate({
    testsPassed: 10, testsFailed: 0,
    requiredArtifacts: ["code"], completedArtifacts: ["code"], evidenceVerified: true,
    delegatedTasks: 1, outOfScopeActions: 1,
  });
  assert.ok(result.score < 80);
  assert.deepEqual(result.reasons.slice(0, 2), ["out-of-scope-action", "unauthorized-delegation"]);
});
