#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root,'docs/agents/SECURITY-RED-TEAM-BOTS.json'),'utf8'));
const workflow = fs.readFileSync(path.join(root,'.github/workflows/security-red-team.yml'),'utf8');

assert.equal(registry.protocol,'FLIXO-SECURITY-RED-TEAM-TRIAD-v1');
assert.equal(registry.branchPolicy.workingBranch,'execution');
assert.equal(registry.branchPolicy.productionBranch,'main');
assert.equal(registry.branchPolicy.thirdBranchAllowed,false);
assert.equal(registry.execution.scanScope,'ALL_GIT_TRACKED_FILES');
assert.equal(registry.execution.mutationAuthority,false);
assert.equal(registry.execution.immediateLedgerPath,'الثغرات الامنيه.md');
assert.equal(Object.keys(registry.bots).length,3);
for (const bot of Object.values(registry.bots)) assert.equal(bot.mutationAuthority,false);
assert.equal(registry.repairIntelligence.entry,'scripts/ci/adversarial-repair-twin.mjs');
assert.equal(registry.repairIntelligence.mutationAuthority,false);

assert.match(workflow,/branches:\s*\[execution\]/u);
assert.match(workflow,/paths-ignore:[\s\S]*الثغرات الامنيه\.md/u);
assert.match(workflow,/expected_sha:/u);
assert.match(workflow,/contents:\s+write/u);
assert.match(workflow,/scripts\/security\/record-security-findings\.mjs/u);
assert.doesNotMatch(workflow,/git\s+push[^\n]*main/iu);
assert.doesNotMatch(workflow,/git\s+switch\s+--create/iu);
assert.doesNotMatch(workflow,/pull_request_target:/u);

const runner = fs.readFileSync(path.join(root,'scripts/security/security-red-team-runner.mjs'),'utf8');
const ledger = fs.readFileSync(path.join(root,'scripts/security/record-security-findings.mjs'),'utf8');
assert.match(runner,/git ls-files -z/u);
assert.match(runner,/mutationAuthority:false/u);
assert.match(runner,/adversarial-repair-twin\.mjs/u);
assert.match(ledger,/ledgerPath = 'الثغرات الامنيه\.md'/u);
assert.match(ledger,/SECURITY_LEDGER_SHA_DIVERGENCE/u);

console.log(JSON.stringify({status:'PASS',protocol:registry.protocol,bots:Object.keys(registry.bots),ledger:registry.execution.immediateLedgerPath},null,2));
