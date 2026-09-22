#!/usr/bin/env node
import assert from 'node:assert/strict';
import { READ_ONLY_POWER_PROFILE, validateReadOnlyPowerProfile } from './read-only-power-profile.mjs';

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
console.log('READ_ONLY_POWER_PROFILE_5X=PASS');
console.log('FIVE_X_EXECUTION_LAYER=PASS');
