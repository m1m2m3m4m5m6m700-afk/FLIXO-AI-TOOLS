import assert from "node:assert/strict";
import test from "node:test";
import { AgentLearningEngine } from "../src/learning.ts";
import { InMemoryExperienceStore } from "../src/experience.ts";
import { DEFAULT_AGENT_NETWORK } from "../src/network.ts";
import type { AgentExperience } from "../src/experience.ts";
import type { AgentReport } from "../src/index.ts";
import type { RewardResult } from "../src/reward.ts";

const report: AgentReport = { stepId: "step-1", commandId: "cmd-1", status: "completed", summary: "done" };
const reward: RewardResult = {
  score: 96, penalty: 0,
  signals: { correctness: 1, verification: 1, quality: 0.9, evidence: 1, efficiency: 1, policyDiscipline: 1 },
  reasons: ["verified-success"],
};
const experience = (id: string, agentId: string): AgentExperience => ({
  id, commandId: "cmd-1", stepId: id, agentId,
  objective: "implement scoped change with tests", report, reward, timestamp: new Date().toISOString(),
});

test("experience memory records and retrieves prior outcomes", () => {
  const store = new InMemoryExperienceStore();
  store.append(experience("exp-1", "implementer"));
  store.append(experience("exp-2", "tester"));
  assert.equal(store.byAgent("implementer").length, 1);
  assert.equal(store.similar("implement scoped change with tests", 2).length, 2);
});

test("learning recommends agents from observed experience without executing them", () => {
  const store = new InMemoryExperienceStore();
  store.append(experience("exp-1", "implementer"));
  store.append(experience("exp-2", "implementer"));
  store.append(experience("exp-3", "implementer"));
  const engine = new AgentLearningEngine(DEFAULT_AGENT_NETWORK, store);
  const recommendations = engine.recommend("implement scoped change with tests", 0.99);
  assert.equal(recommendations[0].agentId, "implementer");
  assert.equal(recommendations[0].sampleCount, 3);
  assert.equal(recommendations[0].exploration, false);
});
