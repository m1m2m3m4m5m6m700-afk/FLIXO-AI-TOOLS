import assert from "node:assert/strict";
import test from "node:test";
import { AgentLearningEngine, AgentLearningObserver } from "../src/learning.ts";
import { InMemoryExperienceStore } from "../src/experience.ts";
import { DEFAULT_AGENT_NETWORK } from "../src/network.ts";
import type { AgentExperience } from "../src/experience.ts";
import type { AgentReport } from "../src/index.ts";
import type { RewardResult } from "../src/reward.ts";
import { DirectCommandOrchestrator } from "../src/index.ts";
import { ContinualLearningEngine } from "../src/continual-learning.ts";

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

test("learning observer converts supervised reports into durable experience", () => {
  const store = new InMemoryExperienceStore();
  const engine = new AgentLearningEngine(DEFAULT_AGENT_NETWORK, store);
  const observer = new AgentLearningObserver(store);
  observer.onDispatch({
    stepId: "step-observe", commandId: "cmd-observe", role: "implementer",
    objective: "implement scoped change with tests", constraints: [], context: {},
  });
  observer.onReport({
    stepId: "step-observe", commandId: "cmd-observe", status: "completed",
    summary: "verified", evidence: {
      testsPassed: 10, testsFailed: 0,
      requiredArtifacts: ["code"], completedArtifacts: ["code"], evidenceVerified: true,
    },
  });
  assert.equal(store.byAgent("implementer").length, 1);
  assert.equal(store.byAgent("implementer")[0]?.reward.score, 100);
  assert.equal(engine.recommend("implement scoped change with tests", 0.99)[0]?.agentId, "implementer");
});


test("failed supervised execution changes the next curriculum focus", async () => {
  const store = new InMemoryExperienceStore();
  const observer = new AgentLearningObserver(store);
  const orchestrator = new DirectCommandOrchestrator({
    async plan(command, objective) {
      return {
        commandId: command.commandId,
        objective,
        steps: [{ stepId: "step-failure-loop", role: "tester", objective, dependsOn: [], constraints: [] }],
      };
    },
  }, observer);

  orchestrator.registerWorker({
    id: "tester",
    async run(instruction) {
      return {
        stepId: instruction.stepId,
        commandId: instruction.commandId,
        status: "failed",
        summary: "verification failed",
        evidence: {
          testsPassed: 1,
          testsFailed: 3,
          evidenceVerified: false,
          outOfScopeActions: 0,
          delegatedTasks: 0,
        },
      };
    },
  });

  const reports = await orchestrator.dispatch(
    { commandId: "cmd-learning-loop", issuedBy: "human", issuedAt: new Date().toISOString() },
    "verify and repair the change",
  );
  assert.equal(reports[0]?.verification?.status, "rejected");
  assert.equal(store.byAgent("tester").length, 1);
  assert.equal(store.byAgent("tester")[0]?.reward.score, 0);

  const curriculum = new ContinualLearningEngine(store).curriculum("tester", "verify and repair the change");
  assert.equal(curriculum[0]?.focus, "verification-test-failure");
});


test("red team adjudication reward is persisted as a secondary learning lane", () => {
  const store = new InMemoryExperienceStore();
  const observer = new AgentLearningObserver(store);
  observer.onDispatch({
    stepId: "step-red-learning", commandId: "cmd-red-learning", role: "red-team",
    objective: "attack change", constraints: [], context: {},
  });
  observer.onReport({
    stepId: "step-red-learning", commandId: "cmd-red-learning", status: "completed",
    summary: "red team result",
    evidence: {
      testsPassed: 1, testsFailed: 0, evidenceVerified: true,
      redTeamReward: {
        score: 88,
        penalty: 0,
        signals: {
          correctness: 1, verification: 1, quality: 1, evidence: 1, efficiency: 1,
          policyDiscipline: 1, adversarialDiscovery: 0.5, adversarialPrecision: 1,
        },
        reasons: ["adversarial-reward-earned"],
      },
    },
  });
  assert.equal(store.byAgent("red-team").length, 2);
  assert.equal(store.byAgent("red-team")[1]?.lane, "red-team");
  assert.equal(store.byAgent("red-team")[1]?.reward.score, 88);
});
