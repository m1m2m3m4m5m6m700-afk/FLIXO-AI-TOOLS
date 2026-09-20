import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const source=fs.readFileSync('scripts/ci/action-vault-pre-mutation-proof.mjs','utf8');
for(const token of [
 'simulateAstRepair(',
 'reproduceStable(',
 'targetIdentity',
 'regressionCounterexamples',
 'PATCH-CORRECTNESS-PROOF-v1',
 'REPAIR-SIMULATION-PROOF-v1',
 'noMutationApplied:true',
 'proofCompleteness',
])assert.ok(source.includes(token),'missing:'+token);

const r=spawnSync(process.execPath,['scripts/ci/action-vault-pre-mutation-proof.mjs','--sha=bad','--fingerprint=fp','--run-id=1'],{encoding:'utf8'});
assert.notEqual(r.status,0);
assert.match(String(r.stderr||r.stdout),/PRE_MUTATION_IDENTITY_REQUIRED/u);
console.log('ACTION_VAULT_PRE_MUTATION_PROOF=PASS');