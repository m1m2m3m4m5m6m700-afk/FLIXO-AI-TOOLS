#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const protocol=fs.readFileSync('docs/agents/ACTION-VAULT-TARGETED-REPAIR-PROTOCOL.md','utf8');
const script=fs.readFileSync('scripts/ci/action-vault-targeted-test.mjs','utf8');
assert.ok(protocol.includes('TARGETED REGRESSION'));
assert.ok(protocol.includes('Canonical CI'));
assert.ok(protocol.includes('EXACT-SHA'));
assert.ok(protocol.includes('COLLABORATION'));
for(const marker of ['affected paths','ACTION-VAULT-AGENT-GRADE.json','ACTION-THREE-BOT-INTELLIGENCE','ACTION-RESIDENCY-POLICY','validate-ci-contract.mjs','fullSuiteRequired']) assert.ok(script.toLowerCase().includes(marker.toLowerCase()),'missing '+marker);
console.log(JSON.stringify({status:'PASS',protocol:'ACTION-VAULT-TARGETED-REPAIR-v1',assertions:8},null,2));
