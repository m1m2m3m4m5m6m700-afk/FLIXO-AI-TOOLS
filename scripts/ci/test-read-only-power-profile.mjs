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
console.log('READ_ONLY_POWER_PROFILE_5X=PASS');
