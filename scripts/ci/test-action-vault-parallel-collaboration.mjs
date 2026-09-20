#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const protocol='docs/agents/ACTION-VAULT-PARALLEL-COLLABORATION-PROTOCOL.md';
const script='scripts/ci/action-three-bot-collaboration.mjs';
const chat='diagnostics/auto-repair/action-vault/CHAT-PROTOCOL.md';
const intelligence=JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json','utf8'));
const residency=JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-RESIDENCY-POLICY.json','utf8'));

assert.ok(fs.existsSync(protocol));
assert.ok(fs.existsSync(script));
assert.ok(fs.readFileSync(protocol,'utf8').includes('CROSS_LEARNING'));
assert.ok(fs.readFileSync(protocol,'utf8').includes('ONE ADMITTED MUTATION SEAT MUTATES'));
assert.ok(fs.readFileSync(chat,'utf8').includes('peer learning'));
assert.ok(fs.readFileSync(chat,'utf8').includes('ACTION-REPAIR-2'));
assert.ok(fs.readFileSync(chat,'utf8').includes('ACTION-HISTORIAN-3'));
assert.equal(intelligence.cooperation.parallelExecution.cognitiveParallelism,true);
assert.equal(intelligence.cooperation.parallelExecution.sourceMutationParallelism,false);
assert.equal(intelligence.cooperation.parallelExecution.allThreeContributionsRequired,true);
assert.equal(intelligence.cooperation.parallelExecution.exchangeBeforeMutation,true);
assert.equal(intelligence.cooperation.parallelExecution.peerLearningReceiptsRequired,true);
assert.equal(intelligence.cooperation.sharedLearning.promotedOnlyAfterCanonicalGreen,true);
assert.equal(intelligence.roleMatrix['ACTION-REPAIR'].mutationAuthority,'ADMITTED_SEAT');
assert.equal(intelligence.roleMatrix['ACTION-REPAIR-2'].mutationAuthority,'ADMITTED_SEAT');
assert.equal(intelligence.roleMatrix['ACTION-HISTORIAN-3'].mutationAuthority,'SUPERVISOR_20_ONLY');
assert.equal(intelligence.cooperation.authority.repairOwner,'SELECTED_TRIAD_SEAT');
assert.equal(intelligence.cooperation.authority.supervisorAfter20,'ACTION-HISTORIAN-3');
assert.equal(residency.residency.noSleepBeforeGreen,true);
assert.equal(residency.residency.noIdleBeforeGreen,true);
assert.equal(residency.sleepAdmission.required,true);
assert.equal(residency.sleepAdmission.openWorkBlocksSleep,true);

const source=fs.readFileSync(script,'utf8');
for(const marker of ['PARALLEL_DISCOVERY','PARALLEL_ANALYSIS','CROSS_LEARNING','CHALLENGE','OWNER_MUTATION','GREEN_LEARNING','allThreeMustContributeBeforeMutation','exchangeBeforeMutation','learnedFromPeers','SUPERVISOR_20_CATALOG_REVIEW_AND_TRIAD_SELECTION','ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-v1','ACTION_THREE_BOT_MUTATOR_SUSPENDED_AT_20','ACTION_THREE_BOT_CLOSE_BLOCKED_NO_GREEN_RECORD']) assert.ok(source.includes(marker),'missing marker: '+marker);

assert.equal(intelligence.cooperation.triadGovernance.recurrenceEscalationThreshold,20);
assert.equal(intelligence.cooperation.triadGovernance.catalogCapacity,1000000);
assert.equal(intelligence.cooperation.triadGovernance.supervisor,'ACTION-HISTORIAN-3');
console.log(JSON.stringify({status:'PASS',authority:'ACTION_VAULT_PARALLEL_COLLABORATION_TEST',assertions:23},null,2));
