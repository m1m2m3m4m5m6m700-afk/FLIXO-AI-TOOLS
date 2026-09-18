import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/ci/repair-strategy.mjs', 'utf8');
assert.match(source, /INTRACTABLE_THRESHOLD, fingerprintFailure/);
assert.match(source, /% strategies\.length/);
assert.match(source, /const threshold = INTRACTABLE_THRESHOLD/);
assert.match(source, /nextAttempt > threshold/);
assert.match(source, /const teachingEscalation =/);
assert.match(source, /const isIntractable = false/);
assert.doesNotMatch(source, /threshold \?\? 10/);
console.log('AUTO_REPAIR_STRATEGY_CONTRACT_SELF_TEST=PASS');
