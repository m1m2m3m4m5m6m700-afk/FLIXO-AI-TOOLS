#!/usr/bin/env node
import assert from 'node:assert/strict';
import { decideAdversarialRound } from './auto-repair/adversarial-convergence.mjs';

const sha='a'.repeat(40);
const verified={
  outcome:'verified-repair',
  targetSha:sha,
  changedPaths:['src/example.ts'],
  selfCritic:{ok:true},
  causalProof:{ok:true},
  repairProof:{ok:true},
};

const cleanTwin={
  status:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
  falsificationComplete:true,
  counterexampleFound:false,
};

const counterTwin={
  status:'COUNTEREXAMPLE_FOUND',
  falsificationComplete:false,
  counterexampleFound:true,
  challenge:{preferredAlternativeStrategy:'alternate-hypothesis'},
  falsificationSearches:[{id:'F05',counterexampleStatus:'COUNTEREXAMPLE_FOUND'}],
};

let result=decideAdversarialRound({engineEvidence:verified,adversarialReport:counterTwin,targetSha:sha,currentSha:sha});
assert.equal(result.decision,'REPAIR_REQUIRED');
assert.equal(result.primaryMayRevise,true);
assert.equal(result.requiresRollback,true);
assert.equal(result.nextStrategy,'alternate-hypothesis');

result=decideAdversarialRound({engineEvidence:verified,adversarialReport:cleanTwin,targetSha:sha,currentSha:sha});
assert.equal(result.decision,'CONVERGED_FOR_VERIFICATION');
assert.equal(result.bothSidesStable,true);
assert.equal(result.primaryMayRevise,false);

result=decideAdversarialRound({
  engineEvidence:{...verified,selfCritic:{ok:false}},
  adversarialReport:cleanTwin,
  targetSha:sha,
  currentSha:sha,
});
assert.equal(result.decision,'REPAIR_REQUIRED');
assert.equal(result.bothSidesStable,false);

result=decideAdversarialRound({engineEvidence:verified,adversarialReport:cleanTwin,targetSha:sha,currentSha:'b'.repeat(40)});
assert.equal(result.decision,'BLOCK_STALE_SHA');

result=decideAdversarialRound({
  engineEvidence:{...verified,changedPaths:[]},
  adversarialReport:cleanTwin,
  targetSha:sha,
  currentSha:sha,
});
assert.equal(result.decision,'REPAIR_ENGINE_BLOCKED');

console.log('test-adversarial-convergence: PASS');
