#!/usr/bin/env node
import assert from 'node:assert/strict';
import { READ_ONLY_POWER_PROFILE, validateReadOnlyPowerProfile, buildFiveXExecutionEnvelope, validateFiveXExecutionLayer } from './read-only-power-profile.mjs';

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
assert.ok(blocked.blockers.includes('FIVE_X_HYPOTHESES_BLOCKED'));

console.log('READ_ONLY_POWER_PROFILE_5X=PASS');
console.log('FIVE_X_EXECUTION_LAYER=PASS');
console.log('FIVE_X_ENVELOPE=PASS');
console.log('FIVE_X_FAIL_CLOSED=PASS');
