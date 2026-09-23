#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildReadOnlyRepairBrain, rankReadOnlyRepairStrategies } from './read-only-repair-brain.mjs';

const sha='a'.repeat(40);
const strategies=rankReadOnlyRepairStrategies({
  classification:'INTERNAL_CONTRACT',
  currentShaEvidence:4,
  recurringDepth:3,
  historicalDepth:20,
  priorStrategies:['workflow-forensics'],
});
assert.equal(strategies.length,10);
assert.notEqual(strategies[0].id,'workflow-forensics');

const brain=buildReadOnlyRepairBrain({
  executionSha:sha,
  observed:[
    {headSha:sha,classification:'INTERNAL_CONTRACT',salientEvidence:['CI contract failed']},
    {headSha:sha,classification:'DOWNSTREAM_FAILURE',salientEvidence:['merge gate']},
  ],
  historicalMemory:[{rule:'workflow-forensics',strategies:['workflow-forensics']}],
  rootCauseCandidates:[{classification:'INTERNAL_CONTRACT',reason:'canonical workflow contract'}],
  deepInference:{falsification:[{id:'F1'}]},
});
assert.equal(brain.protocol,'FLIXO-READ-ONLY-REPAIR-BRAIN-v1');
assert.equal(brain.mutationAuthority,false);
assert.equal(brain.certificationAuthority,false);
assert.equal(brain.tenXAnalyticProfile.requiredPasses,10);
assert.equal(brain.tenXAnalyticProfile.mutationReady,false);
assert.equal(brain.tenXAnalyticProfile.route,'REPORT_ONLY');
assert.equal(brain.adaptiveFailureMemory.newEvidenceRequired,true);
assert.ok(brain.selectedStrategy);
console.log('READ_ONLY_REPAIR_BRAIN_CONTRACT=PASS');
