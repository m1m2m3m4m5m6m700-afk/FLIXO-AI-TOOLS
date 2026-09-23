import assert from 'node:assert/strict';
import { buildAdaptiveFailureMemory, buildTenXRepairProfile } from './repair-ten-x.mjs';
import { evaluateTenXGate } from './repair-ten-x-gate.mjs';

const targetSha = 'a'.repeat(40);

const strategy = {
  targetSha,
  strategyId: 'reproduce-exact',
  failureFingerprint: 'b'.repeat(64),
  fiveXRepair: {
    targetSha,
    completedPasses: 5,
    readyForBoundedMutation: true,
    passes: [
      { id: 'X1_EXACT_SHA', passed: true },
      { id: 'X2_CAUSAL_PROOF', passed: true },
      { id: 'X3_ADVERSARIAL_CHALLENGE', passed: true },
      { id: 'X4_LEARNING_MEMORY', passed: true },
      { id: 'X5_VERIFICATION_PLAN', passed: true },
    ],
  },
  trainingDecision: { eligible: true, mode: 'TRAINED_ROUTING' },
  adaptiveFailureMemory: buildAdaptiveFailureMemory({
    attempt: 2,
    priorStrategies: ['diff-forensics'],
    selectedStrategy: 'reproduce-exact',
    causalRootCause: 'typescript',
  }),
  intelligence: {
    portfolio: [{ id: 'reproduce-exact' }, { id: 'diff-forensics' }],
    rankedStrategies: [
      { id: 'reproduce-exact', rejected: false },
      { id: 'diff-forensics', rejected: false },
    ],
  },
};

const rootProof = {
  protocol: 'CAUSAL-EVIDENCE-GRAPH-v1',
  status: 'PROVEN',
  targetSha,
  sourceMutationAllowed: false,
  proofClaims: {
    ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL: true,
    LOCATION_LINKED_TO_CAUSE: true,
    MECHANISM_EXPLAINED: true,
    ALTERNATIVES_CHALLENGED: true,
  },
};

const rcaManifest = {
  proposed_fix: {
    isolation_level: 'SURGICAL_PATCH',
    scope: { max_source_files: 1 },
  },
  deterministic_proof: { status: 'PRE_MUTATION_BOUNDED' },
};

const masterPacket = {
  protocol: 'FLIXO-MASTER-REPAIR-ORCHESTRATOR-v1',
  authority: 'READ_ONLY_MASTER_REPAIR_GATE',
  mutationAuthority: false,
  certificationAuthority: false,
  target: { targetSha, currentSha: targetSha },
  decision: { status: 'MASTER_REPAIR_READY', confidence: 0.91 },
  intelligence: {
    falsification: Array.from({ length: 10 }, (_, i) => ({ id: 'F' + (i + 1), pass: true })),
  },
};

const profile = buildTenXRepairProfile({ targetSha, strategy, rootProof, rcaManifest, masterPacket });
assert.equal(profile.completedPasses, 10);
assert.equal(profile.readyForMutation, true);
assert.equal(profile.route, 'BOUNDED_REPAIR');

const safe = evaluateTenXGate({ targetSha, liveSha: targetSha, strategy, rootProof, rcaManifest, masterPacket });
assert.equal(safe.completedPasses, 10);
assert.equal(safe.exactLiveSha, true);
assert.equal(safe.readyForMutation, true);

const stale = evaluateTenXGate({ targetSha, liveSha: 'c'.repeat(40), strategy, rootProof, rcaManifest, masterPacket });
assert.equal(stale.exactLiveSha, false);
assert.equal(stale.readyForMutation, false);
assert.equal(stale.route, 'ESCALATE_OR_COLLECT_MORE_EVIDENCE');

const repeated = buildAdaptiveFailureMemory({
  attempt: 5,
  priorStrategies: ['reproduce-exact', 'reproduce-exact', 'diff-forensics', 'historical-analogy'],
  selectedStrategy: 'historical-analogy',
  allStrategiesExhausted: false,
  teachingEscalation: false,
  causalRootCause: 'build',
});
assert.equal(repeated.phase, 'MULTI_ATTEMPT_REQUIRES_STRATEGY_CHANGE');
assert.equal(repeated.newEvidenceRequired, true);
assert.equal(repeated.strategyChangeConfirmed, true);

console.log('REPAIR_TEN_X_GATE_CONTRACT=PASS');
