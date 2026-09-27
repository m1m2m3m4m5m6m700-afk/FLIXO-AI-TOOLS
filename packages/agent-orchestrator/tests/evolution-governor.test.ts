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

test("evolution governor blocks promotion until benchmark and human approval", () => {
  const governor = new EvolutionGovernor();
  governor.propose({
    id: "proposal-1",
    commandId: "cmd-evolution",
    agentId: "implementer",
    target: "sandbox/module",
    summary: "improve bounded implementation",
    baseRevision: "base-1",
    objectiveVerification: verification,
    mutationPlan: { executionBoundary: "sandbox-only" as const, sandboxId: "sandbox-1", targetPaths: ["sandbox/module.ts"], maxFiles: 4, dryRun: true },
  });

  assert.throws(() => governor.requestPromotion("proposal-1"), /EVOLUTION_REQUIRES_BENCHMARK/);

  governor.benchmark("proposal-1", { score: 92, threshold: 80, passed: true, revision: "bench-1" });
  governor.requestPromotion("proposal-1");

  assert.throws(() => governor.recordApplied("proposal-1", "applied-1"), /EVOLUTION_NOT_APPROVED/);
  governor.approve({
    proposalId: "proposal-1",
    commandId: "cmd-evolution",
    approvedBy: "human",
    approvedAt: new Date().toISOString(),
    reason: "explicit human promotion",
    action: "approve",
  });

  const applied = governor.recordApplied("proposal-1", "applied-1");
  assert.equal(applied.status, "applied");
});

test("evolution rollback requires explicit human authorization", () => {
  const governor = new EvolutionGovernor();
  governor.propose({
    id: "proposal-2",
    commandId: "cmd-evolution-2",
    agentId: "tester",
    target: "sandbox/module",
    summary: "bounded improvement",
    baseRevision: "base-2",
    objectiveVerification: { ...verification, id: "verification-2", commandId: "cmd-evolution-2" },
    mutationPlan: { executionBoundary: "sandbox-only", sandboxId: "sandbox-2", targetPaths: ["sandbox/module.ts"], maxFiles: 4, dryRun: true },
  });
  governor.benchmark("proposal-2", { score: 95, threshold: 80, passed: true, revision: "bench-2" });
  governor.requestPromotion("proposal-2");
  governor.approve({
    proposalId: "proposal-2",
    commandId: "cmd-evolution-2",
    approvedBy: "human",
    approvedAt: new Date().toISOString(),
    reason: "approve test",
    action: "approve",
  });
  governor.recordApplied("proposal-2", "applied-2");

  assert.throws(() => governor.rollback({
    proposalId: "proposal-2",
    commandId: "cmd-evolution-2",
    approvedBy: "human",
    approvedAt: new Date().toISOString(),
    reason: "wrong action cannot be inferred",
    action: "approve",
  }, "rollback-2"), /EVOLUTION_HUMAN_ROLLBACK_REQUIRED/);

  const rolledBack = governor.rollback({
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

test("unverified objective cannot request evolution promotion", () => {
  const governor = new EvolutionGovernor();
  governor.propose({
    id: "proposal-3",
    commandId: "cmd-evolution-3",
    agentId: "implementer",
    target: "sandbox/module",
    summary: "unverified change",
    baseRevision: "base-3",
    objectiveVerification: { ...verification, id: "verification-3", commandId: "cmd-evolution-3", status: "unresolved" },
    mutationPlan: { executionBoundary: "sandbox-only", sandboxId: "sandbox-3", targetPaths: ["sandbox/module.ts"], maxFiles: 4, dryRun: true },
  });
  governor.benchmark("proposal-3", { score: 99, threshold: 80, passed: true, revision: "bench-3" });
  assert.throws(() => governor.requestPromotion("proposal-3"), /EVOLUTION_OBJECTIVE_NOT_VERIFIED/);
});


test("evolution governor rejects unsafe mutation targets", () => {
  const governor = new EvolutionGovernor();
  assert.throws(() => governor.propose({
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
