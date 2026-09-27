import assert from "node:assert/strict";
import test from "node:test";
import { EvolutionGovernor } from "../src/evolution-governor.ts";

const verification = {
  id: "verification-1",
  commandId: "cmd-evolution",
  stepId: "step-evolution",
  agentId: "implementer",
  status: "verified" as const,
  checks: [],
  evidence: ["independent verification"],
  reason: "verified",
  verifiedAt: new Date().toISOString(),
};

test("evolution governor blocks promotion until benchmark and human approval", async () => {
  const governor = new EvolutionGovernor();
  await governor.propose({
    id: "proposal-1",
    commandId: "cmd-evolution",
    agentId: "implementer",
    target: "sandbox/module",
    summary: "improve bounded implementation",
    baseRevision: "base-1",
    objectiveVerification: verification,
    mutationPlan: { executionBoundary: "sandbox-only" as const, sandboxId: "sandbox-1", targetPaths: ["sandbox/module.ts"], maxFiles: 4, dryRun: true },
  });

  await assert.rejects(() => governor.requestPromotion("proposal-1"), /EVOLUTION_REQUIRES_BENCHMARK/);

  await governor.benchmark("proposal-1", { score: 92, threshold: 80, passed: true, revision: "bench-1" });
  await governor.requestPromotion("proposal-1");

  await assert.rejects(() => governor.recordApplied("proposal-1", "applied-1"), /EVOLUTION_NOT_APPROVED/);
  await governor.approve({
    proposalId: "proposal-1",
    commandId: "cmd-evolution",
    approvedBy: "human",
    approvedAt: new Date().toISOString(),
    reason: "explicit human promotion",
    action: "approve",
  });

  const applied = await governor.recordApplied("proposal-1", "applied-1");
  assert.equal(applied.status, "applied");
});

test("evolution rollback requires explicit human authorization", async () => {
  const governor = new EvolutionGovernor();
  await governor.propose({
    id: "proposal-2",
    commandId: "cmd-evolution-2",
    agentId: "tester",
    target: "sandbox/module",
    summary: "bounded improvement",
    baseRevision: "base-2",
    objectiveVerification: { ...verification, id: "verification-2", commandId: "cmd-evolution-2" },
    mutationPlan: { executionBoundary: "sandbox-only", sandboxId: "sandbox-2", targetPaths: ["sandbox/module.ts"], maxFiles: 4, dryRun: true },
  });
  await governor.benchmark("proposal-2", { score: 95, threshold: 80, passed: true, revision: "bench-2" });
  await governor.requestPromotion("proposal-2");
  await governor.approve({
    proposalId: "proposal-2",
    commandId: "cmd-evolution-2",
    approvedBy: "human",
    approvedAt: new Date().toISOString(),
    reason: "approve test",
    action: "approve",
  });
  await governor.recordApplied("proposal-2", "applied-2");

  assert.throws(() => governor.rollback({
    proposalId: "proposal-2",
    commandId: "cmd-evolution-2",
    approvedBy: "human",
    approvedAt: new Date().toISOString(),
    reason: "wrong action cannot be inferred",
    action: "approve",
  }, "rollback-2"), /EVOLUTION_HUMAN_ROLLBACK_REQUIRED/);

  const rolledBack = await governor.rollback({
    proposalId: "proposal-2",
    commandId: "cmd-evolution-2",
    approvedBy: "human",
    approvedAt: new Date().toISOString(),
    reason: "explicit human rollback",
    action: "rollback",
  }, "rollback-2");
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(rolledBack.rollbackRevision, "rollback-2");
});

test("unverified objective cannot request evolution promotion", async () => {
  const governor = new EvolutionGovernor();
  await governor.propose({
    id: "proposal-3",
    commandId: "cmd-evolution-3",
    agentId: "implementer",
    target: "sandbox/module",
    summary: "unverified change",
    baseRevision: "base-3",
    objectiveVerification: { ...verification, id: "verification-3", commandId: "cmd-evolution-3", status: "unresolved" },
    mutationPlan: { executionBoundary: "sandbox-only", sandboxId: "sandbox-3", targetPaths: ["sandbox/module.ts"], maxFiles: 4, dryRun: true },
  });
  await governor.benchmark("proposal-3", { score: 99, threshold: 80, passed: true, revision: "bench-3" });
  await assert.rejects(() => governor.requestPromotion("proposal-3"), /EVOLUTION_OBJECTIVE_NOT_VERIFIED/);
});


test("evolution governor rejects unsafe mutation targets", async () => {
  const governor = new EvolutionGovernor();
  await assert.rejects(() => governor.propose({
    id: "proposal-unsafe",
    commandId: "cmd-unsafe",
    agentId: "implementer",
    target: "production",
    summary: "unsafe",
    baseRevision: "base",
    objectiveVerification: { ...verification, id: "verification-unsafe", commandId: "cmd-unsafe" },
    mutationPlan: {
      executionBoundary: "sandbox-only",
      sandboxId: "sandbox-unsafe",
      targetPaths: ["../production/app.ts"],
      maxFiles: 1,
      dryRun: true,
    },
  }), /EVOLUTION_UNSAFE_TARGET_PATH/);
});


test("evolution transitions wait for durable audit persistence", async () => {
  const events: string[] = [];
  const governor = new EvolutionGovernor({
    async persist(event) { events.push(event); },
  });
  await governor.propose({
    id: "proposal-audit",
    commandId: "cmd-audit",
    agentId: "implementer",
    target: "sandbox/module",
    summary: "audited proposal",
    baseRevision: "base-audit",
    objectiveVerification: verification,
    mutationPlan: { executionBoundary: "sandbox-only", sandboxId: "sandbox-audit", targetPaths: ["sandbox/module.ts"], maxFiles: 1, dryRun: true },
  });
  await governor.benchmark("proposal-audit", { score: 91, threshold: 80, passed: true, revision: "bench-audit" });
  await governor.requestPromotion("proposal-audit");
  assert.deepEqual(events, ["proposed", "benchmarked", "awaiting_human_approval"]);
});
