import test from "node:test";
import assert from "node:assert/strict";
import { AgentLearningLab } from "../src/agent-learning-lab.ts";

const participant = (id: string) => ({
  id,
  async propose(challenge: { id: string }) {
    return { challengeId: challenge.id, agentId: id, answer: `answer-${id}`, evidence: ["lab-evidence"], score: id === "a" ? 90 : 70 };
  },
});

test("learning lab runs only while idle and never exposes repository execution", async () => {
  const lab = new AgentLearningLab(undefined, undefined, () => true);
  lab.register(participant("a"));
  lab.register(participant("b"));
  const result = await lab.runChallenge("puzzle", "a", "seed");
  assert.equal(result.submissions.length, 2);
  assert.equal(lab.isolation.repositoryAccess, false);
  assert.equal(lab.isolation.productionExecution, false);
  assert.equal(lab.isolation.networkWriteAccess, false);
  assert.equal(result.winnerIds.includes("a"), true);\n  assert.equal(result.nextChallengeCreatorIds.includes("a"), true);\n  assert.equal(lab.canCreateNextChallenge("a"), true);\n  assert.equal(lab.canCreateNextChallenge("b"), false);\n  const next = lab.createNextChallenge("a", "optimization", "next-seed");\n  assert.equal(next.createdBy, "a");\n  assert.equal(next.game, "optimization");
});

test("learning lab refuses to run while a command is active", async () => {
  const lab = new AgentLearningLab(undefined, undefined, () => false);
  lab.register(participant("a"));
  lab.register(participant("b"));
  await assert.rejects(() => lab.runChallenge("debate", "a", "seed"), /LAB_REQUIRES_IDLE_NETWORK/);
});
\n\ntest("non-winners cannot create the next lab challenge", async () => {\n  const lab = new AgentLearningLab(undefined, undefined, () => true);\n  lab.register(participant("a"));\n  lab.register(participant("b"));\n  await lab.runChallenge("puzzle", "a", "seed");\n  assert.throws(() => lab.createNextChallenge("b", "debate", "bad-seed"), /LAB_CHALLENGE_CREATOR_NOT_AUTHORIZED/);\n});\n