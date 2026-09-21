#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const registry=JSON.parse(fs.readFileSync('docs/agents/ACTION-REPAIR-SQUAD-REGISTRY.json','utf8'));
assert.equal(registry.separation.separateFromCell,true);
assert.equal(registry.separation.cellBotCount,200);
assert.equal(registry.separation.includedInCellCount,false);
assert.deepEqual(registry.workers.filter(x=>x.id!=='ACTION-HISTORIAN-3').map(x=>x.id),['ACTION-TWIN-1','ACTION-TWIN-2','ACTION-INDEX','ACTION-WISE','ACTION-WAKE']);
assert.equal(registry.workers.filter(x=>x.id==='ACTION-HISTORIAN-3').length,1);
assert.equal(registry.repairExecutor.id,'ACTION-REPAIR');
assert.equal(registry.repairExecutor.protocolActor,'actionRepairBot');
assert.equal(registry.repairExecutor.mutationAuthority,true);
assert.equal(registry.repairExecutor.executionAuthority,'SOURCE_MUTATION_VIA_REPAIR_PROTOCOL');
assert.equal(registry.repairExecutor.maxAttemptsPerFingerprint,1000000);
const expected={
 'ACTION-TWIN-1':'ACTION_REPAIR_TWIN_A',
 'ACTION-TWIN-2':'ACTION_REPAIR_TWIN_B',
 'ACTION-INDEX':'ACTION_SOLUTION_INDEXER_SUPPORT',
 'ACTION-WISE':'ACTION_BEST_OPTION_SELECTOR',
 'ACTION-WAKE':'ACTION_SYSTEM_WAKE_COORDINATOR'
};
for(const [id,role] of Object.entries(expected)){
 const worker=registry.workers.find(x=>x.id===id);
 assert.ok(worker);
 assert.equal(worker.role,role);
 assert.equal(worker.mutationAuthority,false);
 assert.equal(worker.executionAuthority,'ANALYSIS_AND_HANDOFF_ONLY');
 assert.match(worker.personalMemoryFile,/^diagnostics\/auto-repair\/action-repair-bots\//u);
}
const cell=JSON.parse(fs.readFileSync('docs/agents/CELL-BOT-REGISTRY.json','utf8'));
assert.equal(cell.bots.length,200);
assert.equal(cell.bots.some(x=>/^ACTION-/u.test(x.id)),false);
assert.equal(Object.prototype.hasOwnProperty.call(cell,'actionRepairCohort'),false);

const sha='0123456789abcdef0123456789abcdef01234567';
const fp='test-action-fingerprint';
const base=['scripts/ci/action-repair-five-workers.mjs',`--target-sha=${sha}`,'--run-id=TEST-RUN-5',`--fingerprint=${fp}`];
const out='/tmp/flixo-five-action-repair-workers-test.json';
execFileSync('node',[...base,'--output='+out],{stdio:'pipe'});
const report=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(report.workerCount,5);
assert.deepEqual(report.roleOrder,Object.values(expected));
for(const worker of report.workers){
 assert.equal(worker.mutationAuthority,false);
 assert.equal(worker.canonicalMutationOwner,'repairAgent');
 assert.equal(worker.sameIncidentContext,true);
}
const wake='/tmp/flixo-action-wake.json';
execFileSync('node',[...base,'--role=wake','--status=RED_INTERNAL','--output='+wake],{stdio:'pipe'});
const wakeResult=JSON.parse(fs.readFileSync(wake,'utf8'));
assert.equal(wakeResult.botId,'ACTION-WAKE');
assert.equal(wakeResult.action,'WAKE_ACTION_REPAIR_SQUAD');
const index='/tmp/flixo-action-index.json';
execFileSync('node',[...base,'--role=index','--output='+index],{stdio:'pipe'});
assert.equal(JSON.parse(fs.readFileSync(index,'utf8')).botId,'ACTION-INDEX');
const historical='/tmp/flixo-action-historical.json';
fs.writeFileSync(historical,JSON.stringify({historicalMatches:[{id:'H-1',normalized:'test',occurrenceCount:3}]}));
const twinA='/tmp/flixo-twin-a.json', twinB='/tmp/flixo-twin-b.json';
fs.writeFileSync(twinA,JSON.stringify({targetSha:sha,mutationAuthority:false,repositoryWrite:false,actionsWrite:false,confidence:.92,falsification:{ok:true},strategyId:'strategy-a'}));
fs.writeFileSync(twinB,JSON.stringify({targetSha:sha,mutationAuthority:false,repositoryWrite:false,actionsWrite:false,confidence:.76,falsification:{ok:true},strategyId:'strategy-b'}));
const select='/tmp/flixo-action-select.json';
execFileSync('node',[...base,'--role=select','--historical='+historical,'--twin-a='+twinA,'--twin-b='+twinB,'--output='+select],{stdio:'pipe'});
const chosen=JSON.parse(fs.readFileSync(select,'utf8'));
assert.equal(chosen.botId,'ACTION-WISE');
assert.equal(chosen.selection.disposition,'SELECTED');
console.log('FIVE_ACTION_REPAIR_SQUAD=PASS');
