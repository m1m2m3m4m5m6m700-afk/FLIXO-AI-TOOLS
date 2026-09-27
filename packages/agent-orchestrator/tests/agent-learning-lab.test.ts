import test from "node:test";
import assert from "node:assert/strict";
import { AgentLearningLab } from "../src/agent-learning-lab.ts";

const participant = (id: string) => ({
  id,
  async propose(challenge: { id: string }) {
    return {
      challengeId: challenge.id,
      agentId: id,
      answer: id === "a" ? `answer-${id}` : "",
      evidence: id === "a" ? ["lab-evidence"] : [],
      score: id === "b" ? 100 : 10,
    };
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
  assert.equal(result.winnerIds.includes("a"), true);
  assert.equal(result.winnerIds.includes("b"), false);
  assert.equal(result.challenge.acceptanceCriteria.length, 2);
  assert.equal(result.evaluations.a.accepted, true);
  assert.equal(result.evaluations.b.accepted, false);
  assert.equal(result.challenge.provenance.source, "template");
  assert.equal(result.nextChallengeCreatorIds.includes("a"), true);
  assert.equal(lab.canCreateNextChallenge("a"), true);
  assert.equal(lab.canCreateNextChallenge("b"), false);
  const next = lab.createNextChallenge("a", "optimization", "next-seed");
  assert.equal(next.createdBy, "a");
  assert.equal(next.game, "optimization");
  assert.equal(next.provenance.source, "adaptive");
  assert.ok(next.difficulty > result.challenge.difficulty);
});

test("learning lab refuses to run while a command is active", async () => {
  const lab = new AgentLearningLab(undefined, undefined, () => false);
  lab.register(participant("a"));
  lab.register(participant("b"));
  await assert.rejects(() => lab.runChallenge("debate", "a", "seed"), /LAB_REQUIRES_IDLE_NETWORK/);
});

test("non-winners cannot create the next lab challenge", async () => {
  const lab = new AgentLearningLab(undefined, undefined, () => true);
  lab.register(participant("a"));
  lab.register(participant("b"));
  await lab.runChallenge("puzzle", "a", "seed");
  assert.throws(() => lab.createNextChallenge("b", "debate", "bad-seed"), /LAB_CHALLENGE_CREATOR_NOT_AUTHORIZED/);
});
