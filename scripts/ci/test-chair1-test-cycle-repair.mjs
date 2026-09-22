#!/usr/bin/env node
import assert from 'node:assert/strict';
import { CHAIR1_REPAIR_MISSION, buildChair1RepairMission, assertChair1RepairState } from './chair1-test-cycle-repair.mjs';

const target = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const main = 'c'.repeat(40);
const fingerprint = 'd'.repeat(64);

const mission = buildChair1RepairMission({
  targetSha: target,
  previousSha: previous,
  latestMainSha: main,
  failureFingerprint: fingerprint,
  failedWorkflow: 'FLIXO Test System',
  changedPathsSincePrevious: ['src/a.ts','tests/a.spec.ts','src/a.ts'],
  changedPathsFromMain: ['src/a.ts','src/b.ts'],
  failureObserved: true,
});

assert.equal(mission.mission, CHAIR1_REPAIR_MISSION);
assert.equal(mission.comparison.previousUpdate.changedPaths.length, 2);
assert.deepEqual(mission.comparison.previousUpdate.changedPaths, ['src/a.ts','tests/a.spec.ts']);
assert.deepEqual(mission.comparison.latestCanonicalState.changedPaths, ['src/a.ts','src/b.ts']);
assert.equal(mission.directRepairPolicy.everyActionableRed, 'MUST_RECEIVE_ROOT_CAUSE_REPAIR_ATTEMPT');
assert.equal(mission.directRepairPolicy.sourcePolicy, 'REPAIR_CAUSAL_SOURCE_ONLY');
assert.equal(mission.noSelfDispatch, true);
assert.equal(mission.noMainMutation, true);
assert.equal(assertChair1RepairState({mission,currentSha:target,branch:'execution'}), true);
assert.throws(() => assertChair1RepairState({mission,currentSha:previous,branch:'execution'}), /CHAIR1_REPAIR_STALE_TARGET_SHA/);
assert.throws(() => assertChair1RepairState({mission,currentSha:target,branch:'main'}), /CHAIR1_REPAIR_BRANCH_BLOCKED/);
assert.throws(() => buildChair1RepairMission({targetSha:target,previousSha:target}), /CHAIR1_REPAIR_PREVIOUS_SHA_EQUALS_TARGET/);

console.log('CHAIR1_PRIMARY_MISSION=PASS');
console.log('CHAIR1_EXACT_SHA_COMPARISON=PASS');
console.log('CHAIR1_LAST_UPDATE_COMPARISON=PASS');
console.log('CHAIR1_CAUSAL_REPAIR_POLICY=PASS');
console.log('CHAIR1_NO_SELF_DISPATCH=PASS');
console.log('CHAIR1_NO_MAIN_MUTATION=PASS');
console.log('CHAIR1_STALE_SHA_FAIL_CLOSED=PASS');
