#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync('docs/agents/CELL-BOT-REGISTRY.json','utf8'));
const cohort=registry.actionRepairCohort;
assert.equal(cohort.workerIds.length,5);
assert.equal(new Set(cohort.workerIds).size,5);
assert.equal(cohort.anyActionFailureAdmitted,true);
assert.equal(cohort.sameReferencesForAll,true);
assert.equal(cohort.mutationAuthority,false);
assert.equal(cohort.canonicalMutationOwner,'repairAgent');
assert.equal(cohort.sharedReferences.includes('docs/agents/historical-action-errors/index.json'),true);
assert.equal(cohort.sharedReferences.includes('docs/agents/historical-action-errors/records'),true);
assert.equal(cohort.sharedReferences.includes('diagnostics/auto-repair/memory.json'),true);
assert.equal(cohort.sharedReferences.includes('docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json'),true);
for(const id of cohort.workerIds){
  const bot=registry.bots.find(x=>x.id===id);
  assert.ok(bot,id);
  assert.equal(bot.cellCouncil,'CELL_TRISEAT_CONTROLLER');
  assert.equal(bot.taskPolicy,'ONE_TASK_AT_A_TIME');
  assert.equal(bot.scopePolicy,'ASSIGNED_SCOPE_ONLY');
}
const out='/tmp/flixo-five-action-repair-workers-test.json';
const sha='0123456789abcdef0123456789abcdef01234567';
const fp='test-action-fingerprint';
const env={...process.env,FLIXO_FIVE_ACTION_REPAIR_OUTPUT:out};
execFileSync('node',['scripts/ci/action-repair-five-workers.mjs',`--target-sha=${sha}`, '--run-id=TEST-RUN-5',`--fingerprint=${fp}`],{env,stdio:'pipe',encoding:'utf8'});
const report=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(report.workerCount,5);
assert.equal(report.workers.length,5);
const refKey=JSON.stringify(report.sharedReferences);
for(const worker of report.workers){
  assert.equal(worker.mutationAuthority,false);
  assert.equal(worker.canonicalMutationOwner,'repairAgent');
  assert.equal(worker.target.failedSha,sha);
  assert.equal(worker.target.failureFingerprint,fp);
  assert.equal(worker.sameIncidentContext,true);
  assert.equal(JSON.stringify(worker.sharedReferences),refKey);
}
assert.equal(new Set(report.workers.map(w=>w.role)).size,5);
console.log('FIVE_ACTION_REPAIR_WORKERS=PASS');
