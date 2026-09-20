#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTION_VAULT_TRIAD_PROTOCOL,
  RECURRENCE_ESCALATION_THRESHOLD,
  CATALOG_CAPACITY,
  escalationFor,
  findCatalogAdvice,
  selectByVault3,
  promoteLearnedAdvice,
} from './action-vault-triad-governor.mjs';

assert.equal(ACTION_VAULT_TRIAD_PROTOCOL, 'ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-v1');
assert.equal(RECURRENCE_ESCALATION_THRESHOLD, 20);
assert.equal(CATALOG_CAPACITY, 1000000);
assert.equal(escalationFor('missing-fingerprint', []).mode, 'NORMAL_TRIAD');

const advice = findCatalogAdvice('workflow schedule failure exact sha root cause');
assert.ok(Array.isArray(advice));
assert.ok(advice.length > 0, 'existing teaching catalog must remain searchable');

const sha='a'.repeat(40);
const selected=selectByVault3({
  taskId:'TRIAD-TEST',
  fingerprint:'b'.repeat(64),
  targetSha:sha,
  proposal1:'repair the root cause and add a targeted regression with exact SHA evidence',
  proposal2:'retry the workflow and suppress the regression',
  advice:[{ruleId:'T001',advice:'repair the root cause and run targeted regression on the exact SHA'}],
});
assert.equal(selected.supervisor,'ACTION-HISTORIAN-3');
assert.equal(selected.selectedBot,'ACTION-REPAIR');

const escalation=escalationFor('same', Array.from({length:20},(_,i)=>({failureFingerprint:'same',eventType:'REPAIR_FAILED',result:'FAILED',failedRunId:String(1000+i),at:i})));
assert.equal(escalation.mode,'SUPERVISOR_20');
assert.deepEqual(escalation.suspendedBots,['ACTION-REPAIR','ACTION-REPAIR-2']);
assert.equal(escalation.supervisor,'ACTION-HISTORIAN-3');
assert.throws(() => promoteLearnedAdvice({taskId:'T',fingerprint:'f',targetSha:sha,failedRunId:'r',advice:'new advice',greenRecord:{source:'DAILY_FLIXO_GREEN_GATE',conclusion:'failure',zeroRed:false,exactShaVerified:false,targetSha:sha}}),/GREEN_PROOF_REQUIRED/);

console.log('ACTION_VAULT_TRIAD_GOVERNANCE=PASS');
console.log('ACTION_VAULT_20X_ESCALATION=PASS');
console.log('ACTION_VAULT_CATALOG_MISS_GATE=PASS');
