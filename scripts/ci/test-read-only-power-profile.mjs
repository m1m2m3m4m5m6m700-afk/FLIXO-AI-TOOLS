#!/usr/bin/env node
import assert from 'node:assert/strict';
import { READ_ONLY_POWER_PROFILE, validateReadOnlyPowerProfile, buildFiveXExecutionEnvelope, validateFiveXExecutionLayer, buildFiveXRepairCycleState } from './read-only-power-profile.mjs';

const result = validateReadOnlyPowerProfile();
assert.equal(result.ok, true);
assert.equal(READ_ONLY_POWER_PROFILE.profile, '5X');
assert.equal(READ_ONLY_POWER_PROFILE.multiplier, 5);
assert.equal(READ_ONLY_POWER_PROFILE.mutationAuthority, false);
assert.equal(READ_ONLY_POWER_PROFILE.exactShaRequired, true);
assert.equal(Object.keys(READ_ONLY_POWER_PROFILE.dimensions).length, 5);
assert.ok(READ_ONLY_POWER_PROFILE.layers.includes('ADVERSARIAL_FALSIFICATION_EXPANSION'));
const fiveX = READ_ONLY_POWER_PROFILE.execution;
assert.equal(fiveX.protocol, 'FLIXO-FIVE-X-EXECUTION-LAYER-v1');
assert.equal(fiveX.layerCount, 5);
assert.equal(fiveX.requiredEvidenceClassCount, 5);
assert.ok(fiveX.minimumHypotheses >= 3);
assert.ok(fiveX.maximumHypotheses >= fiveX.minimumHypotheses);
assert.ok(fiveX.minimumCounterexampleChecks >= 5);
assert.ok(fiveX.minimumRegressionDepth >= 3);
assert.ok(fiveX.minimumIndependentEvidenceSources >= 5);
assert.ok(fiveX.minimumLearningOutputs >= 5);
assert.equal(validateFiveXExecutionLayer().ok, true);

const sha = 'a'.repeat(40);
const ready = buildFiveXExecutionEnvelope({
  exactSha: sha,
  branch: 'execution',
  selectedTaskId: 'FIVE-X-001',
  hypothesisCount: 5,
  counterexampleChecks: 10,
  regressionDepth: 3,
  independentEvidenceSources: 5,
  learningOutputs: 5,
  proofClasses: ['IDENTITY', 'CONSTRAINTS', 'CAUSALITY', 'FALSIFICATION', 'REGRESSION'],
  preExecution25: { status: 'PASS', operationCount: 25 },
  adversarialReview: { status: 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE', counterexampleFound: false },
  scopeConflict: false,
});
assert.equal(ready.status, 'READY_FOR_AUTHORIZED_EXECUTION');
assert.equal(ready.checks.hypotheses, true);
assert.equal(ready.checks.counterexampleSearch, true);
assert.equal(ready.checks.regressionDepth, true);
assert.equal(ready.checks.evidenceDiversity, true);
assert.equal(ready.checks.learningOutputs, true);
assert.equal(ready.checks.proofClasses, true);

const blocked = buildFiveXExecutionEnvelope({
  exactSha: sha,
  branch: 'execution',
  selectedTaskId: 'FIVE-X-001',
  hypothesisCount: 2,
  counterexampleChecks: 10,
  regressionDepth: 3,
  independentEvidenceSources: 5,
  learningOutputs: 5,
  proofClasses: ['IDENTITY', 'CONSTRAINTS', 'CAUSALITY', 'FALSIFICATION', 'REGRESSION'],
  preExecution25: { status: 'PASS', operationCount: 25 },
  adversarialReview: { status: 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE', counterexampleFound: false },
  scopeConflict: false,
});
assert.equal(blocked.status, 'BLOCKED');
const cycle1 = buildFiveXRepairCycleState({
  phase:'PRE_MUTATION',
  chainId:'CHAIN-1',
  taskId:'TASK-1',
  failureFingerprint:'f'.repeat(64),
  attempt:1,
  targetSha:sha,
  currentSha:sha,
  strategyId:'strategy-a',
  learningOutputs:5,
  adversarialStatus:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
  counterexampleFound:false,
});
assert.equal(cycle1.state,'READY_TO_CONTINUE');
assert.equal(cycle1.mutationReady,true);
const cycle2 = buildFiveXRepairCycleState({
  phase:'PRE_MUTATION',
  chainId:'CHAIN-1',
  taskId:'TASK-1',
  failureFingerprint:'f'.repeat(64),
  attempt:2,
  targetSha:'b'.repeat(40),
  currentSha:'b'.repeat(40),
  strategyId:'strategy-a',
  previousCycle:cycle1,
  learningOutputs:5,
  adversarialStatus:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
  counterexampleFound:false,
});
assert.equal(cycle2.state,'STALE_EVIDENCE');
assert.equal(cycle2.mutationReady,false);
const cycle3 = buildFiveXRepairCycleState({
  phase:'PRE_MUTATION',
  chainId:'CHAIN-1',
  taskId:'TASK-1',
  failureFingerprint:'f'.repeat(64),
  attempt:2,
  targetSha:sha,
  currentSha:sha,
  strategyId:'strategy-a',
  previousCycle:cycle1,
  learningOutputs:5,
  adversarialStatus:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
  counterexampleFound:false,
});
assert.equal(cycle3.state,'STRATEGY_REPEAT_BLOCKED');
assert.equal(cycle3.mutationReady,false);
const cycle4 = buildFiveXRepairCycleState({
  phase:'POST_MUTATION',
  chainId:'CHAIN-1',
  taskId:'TASK-1',
  failureFingerprint:'f'.repeat(64),
  attempt:1,
  targetSha:sha,
  currentSha:sha,
  strategyId:'strategy-a',
  learningOutputs:5,
  outcome:'verified-repair',
  verification:'exact-sha-proof',
  regressionOk:true,
  regressionDepth:3,
});
assert.equal(cycle4.state,'VERIFICATION_PENDING_CANONICAL_GREEN');
assert.equal(cycle4.closureAuthority,'NONE');
const cycle5 = buildFiveXRepairCycleState({
  phase:'POST_MUTATION',
  chainId:'CHAIN-1',
  taskId:'TASK-1',
  failureFingerprint:'f'.repeat(64),
  attempt:1,
  targetSha:sha,
  currentSha:sha,
  strategyId:'strategy-a',
  learningOutputs:5,
  outcome:'verified-repair',
  verification:'exact-sha-proof',
  regressionOk:true,
  regressionDepth:3,
  canonicalGreen:true,
});
assert.equal(cycle5.state,'CLOSED_BY_CANONICAL_GREEN');
assert.equal(cycle5.closureAuthority,'CANONICAL_GREEN_AND_CERTIFICATION');

console.log('FIVE_X_REPAIR_CYCLE=PASS');
assert.ok(blocked.blockers.includes('FIVE_X_HYPOTHESES_BLOCKED'));

console.log('READ_ONLY_POWER_PROFILE_5X=PASS');
console.log('FIVE_X_EXECUTION_LAYER=PASS');
console.log('FIVE_X_ENVELOPE=PASS');
console.log('FIVE_X_FAIL_CLOSED=PASS');
