#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildMetaCausalModel } from './meta-causal-model.mjs';

const SHA='1234567890abcdef1234567890abcdef12345678';

const local=buildMetaCausalModel({
  failureLog:'src/lib/demo.ts:42 TS1064 return type of an async function must be Promise',
  targetSha:SHA,
  failedRunId:'100',
  taskId:'task-local',
  branch:'execution',
});
assert.equal(local.protocol,'META-CAUSAL-MODEL-v1');
assert.equal(local.mutationAllowed,true);
assert.equal(local.governingRoot,'CAUSAL-OBSERVABILITY-LOSS');

const stale=buildMetaCausalModel({
  failureLog:'TS1064 after newer commit; current HEAD differs from target SHA',
  targetSha:SHA,
  currentHeadSha:'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
  failedRunId:'101',
  taskId:'task-stale',
  branch:'execution',
});
assert.equal(stale.mutationAllowed,false);
assert.ok(stale.hardBlocks.includes('CURRENT_HEAD_DIFFERS_FROM_TARGET_SHA'));
assert.equal(stale.governingRoot,'TEMPORAL-IDENTITY-COLLAPSE');

const external=buildMetaCausalModel({
  failureLog:'provider rate limit external failure; source mutation proposed',
  targetSha:SHA,
  failedRunId:'102',
  taskId:'task-external',
  branch:'execution',
});
assert.equal(external.mutationAllowed,false);
assert.ok(external.hardBlocks.includes('EXTERNAL_FAILURE_SOURCE_MUTATION_COLLISION'));
assert.equal(external.governingRoot,'BOUNDARY-CONTAMINATION');

const repeat=buildMetaCausalModel({
  failureLog:'same failure repeated; same strategy reverted and retry requested',
  targetSha:SHA,
  failedRunId:'103',
  taskId:'task-repeat',
  branch:'execution',
  doNotRepeat:['known-bad-strategy'],
});
assert.equal(repeat.mutationAllowed,false);
assert.ok(repeat.hardBlocks.includes('HISTORICALLY_REJECTED_STRATEGY_PRESENT'));
assert.equal(repeat.governingRoot,'FEEDBACK-LEARNING-LOOP-FAILURE');

const branch=buildMetaCausalModel({
  failureLog:'repair attempted on main branch',
  targetSha:SHA,
  failedRunId:'104',
  taskId:'task-branch',
  branch:'main',
});
assert.equal(branch.mutationAllowed,false);
assert.ok(branch.hardBlocks.includes('MUTATION_BRANCH_NOT_EXECUTION'));
assert.equal(branch.governingRoot,'AUTHORITY-TOPOLOGY-COLLAPSE');

console.log(JSON.stringify({
  status:'PASS',
  protocol:'META-CAUSAL-MODEL-v1',
  cases:['LOCAL','TEMPORAL_IDENTITY','EXTERNAL_BOUNDARY','FEEDBACK_LOOP','AUTHORITY_TOPOLOGY'],
  causalObservabilityInvariant:local.invariant,
},null,2));
