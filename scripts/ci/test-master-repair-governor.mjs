import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('scripts/ci/master-repair-governor.mjs','utf8');
const contract = JSON.parse(fs.readFileSync('docs/agents/master-repair-20x-contract.json','utf8'));
for (const token of [
  'FLIXO-MASTER-REPAIR-GOVERNOR-v1',
  'UNTRUSTED',
  'PATCH_TRUTH',
  'TWO_OF_THREE_AUTHORITY_NOT_REACHED',
  'SELF_CONTRADICTION_DETECTED',
  'failureTaxonomy',
  'proofChain',
  'noImplicitTrust',
]) assert.ok(source.includes(token), token);
assert.equal(contract.rules.length, 20);
assert.equal(contract.defaultTrust, 'UNTRUSTED');
console.log('MASTER_REPAIR_20X_CONTRACT=PASS');
