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
assert.ok(fs.readFileSync(protocol,'utf8').includes('ONE OWNER MUTATES'));
assert.ok(fs.readFileSync(chat,'utf8').includes('peer learning'));
assert.ok(fs.readFileSync(chat,'utf8').includes('ACTION-REPAIR-2'));
assert.ok(fs.readFileSync(chat,'utf8').includes('ACTION-HISTORIAN-3'));
assert.equal(intelligence.cooperation.parallelExecution.cognitiveParallelism,true);
assert.equal(intelligence.cooperation.parallelExecution.sourceMutationParallelism,false);
assert.equal(intelligence.cooperation.parallelExecution.allThreeContributionsRequired,true);
assert.equal(intelligence.cooperation.parallelExecution.exchangeBeforeMutation,true);
assert.equal(intelligence.cooperation.parallelExecution.peerLearningReceiptsRequired,true);
assert.equal(intelligence.cooperation.sharedLearning.promotedOnlyAfterCanonicalGreen,true);
assert.equal(intelligence.roleMatrix['ACTION-REPAIR'].role,'PRIMARY_PROGRAMMING_REPAIR_OWNER');
assert.equal(intelligence.roleMatrix['ACTION-REPAIR-2'].role,'HISTORICAL_INDEX_EXPLORER_AND_PREDICTOR');
assert.equal(intelligence.roleMatrix['ACTION-HISTORIAN-3'].role,'FAILURE_LEDGER_AND_LEARNING_RECORDER');
assert.equal(intelligence.cooperation.authority.repairOwner,'ACTION-REPAIR');
assert.equal(intelligence.cooperation.authority.predictionOwner,'ACTION-REPAIR-2');
assert.equal(residency.residency.noSleepBeforeGreen,true);
assert.equal(residency.residency.noIdleBeforeGreen,true);
assert.equal(residency.sleepAdmission.required,true);
assert.equal(residency.sleepAdmission.openWorkBlocksSleep,true);

const source=fs.readFileSync(script,'utf8');
for(const marker of ['PARALLEL_DISCOVERY','PARALLEL_ANALYSIS','CROSS_LEARNING','CHALLENGE','OWNER_MUTATION','GREEN_LEARNING','allThreeMustContributeBeforeMutation','exchangeBeforeMutation','learnedFromPeers','HISTORICAL_INDEX_EXPLORATION_AND_REPAIR_PREDICTION','PROGRAMMER_THINKING_AND_BOUNDED_SOURCE_REPAIR','FAILURE_LEDGER_AND_LEARNING_RECORDING','ACTION_THREE_BOT_ONLY_PROGRAMMER_OWNER_MAY_MUTATE','ACTION_THREE_BOT_CLOSE_BLOCKED_NO_GREEN_RECORD']) assert.ok(source.includes(marker),'missing marker: '+marker);

console.log(JSON.stringify({status:'PASS',authority:'ACTION_VAULT_PARALLEL_COLLABORATION_TEST',assertions:19},null,2));
