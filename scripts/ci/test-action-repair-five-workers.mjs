#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const registry=JSON.parse(fs.readFileSync('docs/agents/CELL-BOT-REGISTRY.json','utf8'));
const cohort=registry.actionRepairCohort;
assert.deepEqual(cohort.workerIds,['CELL-001','CELL-002','CELL-003','CELL-004','CELL-005']);
assert.equal(cohort.sameReferencesForAll,true);
assert.equal(cohort.anyActionFailureAdmitted,true);
assert.equal(cohort.mutationAuthority,false);
assert.equal(cohort.canonicalMutationOwner,'repairAgent');
assert.equal(cohort.wakePolicy,'ACTION_SYSTEM_WAKE_COORDINATOR -> EXISTING_CANONICAL_DISPATCHER_ONLY');
assert.equal(cohort.selectionPolicy,'HISTORICAL_PLUS_TWIN_A_PLUS_TWIN_B -> BEST_OPTION_SELECTOR -> repairAgent');
const expected={
 'CELL-001':'ACTION_SOLUTION_INDEXER',
 'CELL-002':'ACTION_SYSTEM_WAKE_COORDINATOR',
 'CELL-003':'ACTION_REPAIR_TWIN_A',
 'CELL-004':'ACTION_REPAIR_TWIN_B',
 'CELL-005':'ACTION_BEST_OPTION_SELECTOR'
};
for(const id of cohort.workerIds){
 assert.equal(cohort.workerModes[id],expected[id]);
 const bot=registry.bots.find(x=>x.id===id);
 assert.equal(bot.taskIdentity.shortName,expected[id]);
 assert.equal(bot.executionAuthority,'DELEGATED_BY_CONTROL_PLANE');
 assert.equal(bot.taskPolicy,'ONE_TASK_AT_A_TIME');
 assert.equal(bot.scopePolicy,'ASSIGNED_SCOPE_ONLY');
 assert.equal(bot.currentAssignment.mutationAuthority,false);
}
const sha='0123456789abcdef0123456789abcdef01234567';
const fp='test-action-fingerprint';
const base=['scripts/ci/action-repair-five-workers.mjs',`--target-sha=${sha}`,'--run-id=TEST-RUN-5',`--fingerprint=${fp}`];
const out='/tmp/flixo-five-action-repair-workers-test.json';
execFileSync('node',[...base,'--output='+out],{stdio:'pipe'});
const report=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(report.workerCount,5);
assert.deepEqual(report.roleOrder,Object.values(expected));
const shared=JSON.stringify(report.sharedReferences);
for(const worker of report.workers){
 assert.equal(worker.mutationAuthority,false);
 assert.equal(worker.canonicalMutationOwner,'repairAgent');
 assert.equal(JSON.stringify(worker.sharedReferences),shared);
 assert.equal(worker.sameIncidentContext,true);
}
const wake='/tmp/flixo-action-wake.json';
execFileSync('node',[...base,'--role=wake','--status=RED_INTERNAL','--output='+wake],{stdio:'pipe'});
assert.equal(JSON.parse(fs.readFileSync(wake,'utf8')).canonicalNextStep,'EXISTING_CANONICAL_DISPATCHER');
const index='/tmp/flixo-action-index.json';
execFileSync('node',[...base,'--role=index','--output='+index],{stdio:'pipe'});
assert.equal(JSON.parse(fs.readFileSync(index,'utf8')).botId,'CELL-001');
const select='/tmp/flixo-action-select.json';
const historical='/tmp/flixo-action-historical.json';
fs.writeFileSync(historical,JSON.stringify({historicalMatches:[{id:'H-1',normalized:'test',occurrenceCount:3}]}));
const twinA='/tmp/flixo-twin-a.json', twinB='/tmp/flixo-twin-b.json';
fs.writeFileSync(twinA,JSON.stringify({targetSha:sha,mutationAuthority:false,repositoryWrite:false,actionsWrite:false,confidence:.92,falsification:{ok:true}}));
fs.writeFileSync(twinB,JSON.stringify({targetSha:sha,mutationAuthority:false,repositoryWrite:false,actionsWrite:false,confidence:.76,falsification:{ok:true}}));
execFileSync('node',[...base,'--role=select','--historical='+historical,'--twin-a='+twinA,'--twin-b='+twinB,'--output='+select],{stdio:'pipe'});
const chosen=JSON.parse(fs.readFileSync(select,'utf8'));
assert.equal(chosen.selection.disposition,'SELECTED');
assert.ok(['TWIN_A','TWIN_B','HISTORICAL'].includes(chosen.selection.selected));
console.log('FIVE_ACTION_REPAIR_ROLES=PASS');
