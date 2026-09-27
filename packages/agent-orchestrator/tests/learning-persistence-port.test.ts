import assert from "node:assert/strict";
import test from "node:test";
import { AgentLearningObserver } from "../src/learning.ts";
import { InMemoryExperienceStore, type AgentExperience, type AgentExperiencePersistence } from "../src/experience.ts";

const makeExperience = (id: string): AgentExperience => ({
  id, commandId: "cmd-" + id, stepId: "step-" + id, agentId: "tester", objective: "verify persistence",
  report: { stepId: "step-" + id, commandId: "cmd-" + id, status: "completed", summary: "verified",
    evidence: { testsPassed: 2, testsFailed: 0, evidenceVerified: true },
    verification: { id: "verification-" + id, commandId: "cmd-" + id, stepId: "step-" + id, agentId: "tester", status: "verified", checks: [], evidence: ["tests passed"], reason: "verified", verifiedAt: new Date().toISOString() } },
  reward: { score: 100, signals: { correctness: 1, verification: 1, quality: 1, evidence: 1, efficiency: 1, policyDiscipline: 1, adversarialDiscovery: 0, adversarialPrecision: 0 }, penalty: 0, reasons: ["verified-success"] },
  timestamp: new Date().toISOString(),
});

class FakePersistence implements AgentExperiencePersistence {
  readonly persisted: AgentExperience[] = [];
  async persist(value: AgentExperience): Promise<void> { this.persisted.push(value); }
  async load(): Promise<readonly AgentExperience[]> { return Object.freeze([...this.persisted]); }
}

test("learning observer waits for durable persistence before returning", async () => {
  const store = new InMemoryExperienceStore();
  const persistence = new FakePersistence();
  const observer = new AgentLearningObserver(store, undefined, undefined, undefined, persistence);
  observer.onDispatch({ stepId: "step-1", commandId: "cmd-1", role: "tester", objective: "verify persistence", constraints: [], context: {} });
  await observer.onReport({ stepId: "step-1", commandId: "cmd-1", status: "completed", summary: "verified", evidence: { testsPassed: 2, testsFailed: 0, evidenceVerified: true } });
  assert.equal(persistence.persisted.length, 1);
  assert.equal(persistence.persisted[0]?.reward.score, 100);
});

test("learning observer hydrates persisted experience without duplicates", async () => {
  const store = new InMemoryExperienceStore();
  const persistence = new FakePersistence();
  persistence.persisted.push(makeExperience("hydrated"));
  const observer = new AgentLearningObserver(store, undefined, undefined, undefined, persistence);
  await observer.hydrate();
  await observer.hydrate();
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0]?.id, "hydrated");
});