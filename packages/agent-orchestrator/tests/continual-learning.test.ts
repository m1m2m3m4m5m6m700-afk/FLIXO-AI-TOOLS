import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryExperienceStore } from "../src/experience.ts";
import { ContinualLearningEngine } from "../src/continual-learning.ts";

const experience = (agentId: string, score: number, index: number) => Object.freeze({
  id: `experience-${agentId}-${index}`,
  commandId: `command-${index}`,
  stepId: `step-${index}`,
  agentId,
  objective: "improve implementation quality",
  report: Object.freeze({
    stepId: `step-${index}`,
    commandId: `command-${index}`,
    status: "completed" as const,
    summary: "verified",
  }),
  reward: Object.freeze({
    score,
    components: Object.freeze({
      correctness: score / 100,
      verification: score / 100,
      quality: score / 100,
      evidence: score / 100,
      efficiency: score / 100,
      policyDiscipline: 1,
    }),
    reasons: Object.freeze(["verified-success"]),
    penalty: 0,
  }),
  timestamp: new Date().toISOString(),
});

test("continual learning grows with experiences and produces curriculum", () => {
  const store = new InMemoryExperienceStore();
  const learning = new ContinualLearningEngine(store);
  learning.record(experience("implementer", 92, 1));
  learning.record(experience("implementer", 88, 2));
  learning.record(experience("implementer", 95, 3));
  const snapshot = learning.snapshot("implementer");
  assert.equal(snapshot.sampleCount, 3);
  assert.ok(snapshot.averageReward > 90);
  const curriculum = learning.curriculum("implementer", "implement a scoped change");
  assert.equal(curriculum.length, 8);
  assert.ok(curriculum[0].priority > curriculum[7].priority);
});

test("skill memory identifies weak patterns and targets them in curriculum",()=>{ const store=new InMemoryExperienceStore(); const learning=new ContinualLearningEngine(store); learning.record(experience("tester",30,1)); const snapshot=learning.snapshot("tester"); assert.ok(snapshot.skills.length>0); assert.ok(snapshot.weaknesses.length>0); const item=learning.curriculum("tester","verify a change")[0]; assert.equal(item.focus,"below-reward-threshold"); assert.ok(item.difficulty>0); });
