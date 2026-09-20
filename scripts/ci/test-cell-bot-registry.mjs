import assert from 'node:assert/strict';
import fs from 'node:fs';
const registry=JSON.parse(fs.readFileSync('docs/agents/CELL-BOT-REGISTRY.json','utf8'));
assert.equal(registry.schemaVersion,2);
assert.equal(registry.authority,'CELL_CONTROL_PLANE');
assert.equal(registry.bots.length,50);
assert.equal(new Set(registry.bots.map((bot)=>bot.id)).size,50);
assert(registry.bots.every((bot)=>bot.kind==='RAW_BOT'));
assert(registry.bots.every((bot)=>bot.permissions.length===0));
assert(registry.bots.every((bot)=>bot.supervisor==='assistantController'));
assert(registry.bots.every((bot)=>bot.taskPolicy==='ONE_TASK_AT_A_TIME'));
assert(registry.bots.every((bot)=>bot.scopePolicy==='ASSIGNED_SCOPE_ONLY'));
assert(registry.bots.every((bot)=>bot.lifecycle?.bootstrapOnly===true));
assert(registry.bots.every((bot)=>bot.status==='RAW'));
assert(registry.bots.every((bot)=>bot.taskIdentity?.state==='UNLEARNED'));
assert(registry.bots.every((bot)=>bot.currentAssignment===null));
assert.deepEqual(registry.lifecycle.allowedStates,['RAW','LEARNING','SPECIALIZING','UPGRADING','READY','RECYCLE']);
assert.equal(registry.lifecycle.firstTaskExitGate,'CLOSED_ATTENDANCE + INDEPENDENT_RESULT_REVIEW');

const squad=registry.actionRepairCohort;
assert.deepEqual(squad.workerIds,['CELL-001','CELL-002','CELL-003','CELL-004','CELL-005']);
assert.equal(squad.sameReferencesForAll,true);
assert.equal(squad.anyActionFailureAdmitted,true);
assert.equal(squad.mutationAuthority,false);
assert.equal(squad.canonicalMutationOwner,'repairAgent');
const expected={
  'CELL-001':'ACTION_SOLUTION_INDEXER',
  'CELL-002':'ACTION_SYSTEM_WAKE_COORDINATOR',
  'CELL-003':'ACTION_REPAIR_TWIN_A',
  'CELL-004':'ACTION_REPAIR_TWIN_B',
  'CELL-005':'ACTION_BEST_OPTION_SELECTOR'
};
for(const id of squad.workerIds){
  assert.equal(squad.workerModes[id],expected[id]);
  const bot=registry.bots.find((item)=>item.id===id);
  assert.ok(bot);
  assert.equal(squad.workerModes[id],expected[id]);
  assert.equal(bot.cellCouncil,'CELL_TRISEAT_CONTROLLER');
  assert.equal(bot.reassignmentPolicy,'ANY_ADMITTED_TASK');
  assert.equal(bot.returnPolicy,'RETURN_TO_POOL_WITH_KNOWLEDGE');
  assert.equal(bot.personalMemoryFile,'diagnostics/auto-repair/cell-bots/'+id+'.json');
}
const actionReader=registry.bots.find((bot)=>bot.id==='CELL-001');
assert.equal(actionReader.status,'RAW');
assert.equal(actionReader.taskIdentity.fullName,'UNLEARNED_TASK');
assert.equal(actionReader.currentAssignment,null);
assert.equal(actionReader.upgradeTarget.upgradePriority,1);
assert.equal(actionReader.memoryPolicy,'LEARN_PERSIST_COPYABLE_REUSE');

assert(registry.bots.every((bot)=>bot.capabilityMode==='SPECIALIZED_PLUS_GENERAL'));
assert(registry.personalMemory.copyable===true);
assert(registry.personalMemory.transferableKnowledgeOnly===true);
assert(registry.personalMemory.permissionsNeverCopied===true);
assert(registry.personalMemory.independentAuthorityNeverCopied===true);

console.log('CELL_BOT_REGISTRY=PASS');
console.log('CELL_BOT_COUNT=50');
console.log('CELL_ACTION_REPAIR_SQUAD=5');
