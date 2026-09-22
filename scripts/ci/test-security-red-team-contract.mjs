#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root,'docs/agents/SECURITY-RED-TEAM-BOTS.json'),'utf8'));
const workflow = fs.readFileSync(path.join(root,'.github/workflows/security-red-team.yml'),'utf8');
const registryText = fs.readFileSync(path.join(root,'scripts/ci/control-plane-registry.mjs'),'utf8');
const runnerText = fs.readFileSync(path.join(root,'scripts/security/security-red-team-runner.mjs'),'utf8');

assert.equal(registry.protocol,'FLIXO-SECURITY-RED-TEAM-TRIAD-v1');
assert.equal(registry.branchPolicy.workingBranch,'execution');
assert.equal(registry.branchPolicy.productionBranch,'main');
assert.equal(registry.branchPolicy.thirdBranchAllowed,false);
assert.equal(registry.execution.scanScope,'ALL_GIT_TRACKED_FILES');
assert.equal(registry.execution.mutationAuthority,false);
assert.equal(registry.execution.certificationAuthority,false);
assert.equal(registry.execution.greenAuthority,false);
assert.equal(registry.execution.evidenceOutput,'workflow-artifact');
assert.equal(registry.execution.sourceLedgerMutation,false);
assert.equal(registry.execution.isolation.mode,'EPHEMERAL_RUNNER_PER_BOT');
assert.equal(registry.execution.isolation.workflowTrigger,'MANUAL_DISPATCH_ONLY');
assert.equal(registry.execution.isolation.repositoryAccess,'CONTENTS_READ_ONLY');
assert.equal(registry.execution.isolation.sourceMutation,false);
assert.equal(registry.execution.isolation.ledgerMutation,false);
assert.equal(registry.execution.isolation.peerWake,false);
assert.equal(registry.execution.isolation.sharedWorkspace,false);
assert.equal(registry.execution.isolation.evidence,'ARTIFACT_ONLY');

assert.equal(Object.keys(registry.bots).length,3);
for (const bot of Object.values(registry.bots)) assert.equal(bot.mutationAuthority,false);
assert.equal(registry.repairIntelligence.entry,'scripts/ci/adversarial-repair-twin.mjs');
assert.equal(registry.repairIntelligence.mutationAuthority,false);

assert.match(workflow,/workflow_dispatch:/u);
assert.match(workflow,/expected_sha:[\s\S]*required:\s*true/u);
assert.doesNotMatch(workflow,/push:\s*\n/u);
assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/u);
assert.doesNotMatch(workflow,/actions:\s+write/u);
assert.match(workflow,/strategy:[\s\S]*matrix:[\s\S]*SECURITY-REDTEAM-1[\s\S]*SECURITY-REDTEAM-2[\s\S]*SECURITY-REDTEAM-3/u);
assert.match(workflow,/persist-credentials:\s*false/u);
assert.match(workflow,/security-red-team-runner\.mjs/u);
assert.match(workflow,/FLIXO_TWIN_READ_ONLY:\s*"true"/u);
assert.match(workflow,/FLIXO_TWIN_DETACHED:\s*"true"/u);
assert.match(workflow,/mutationAuthority\s*==\s*false/u);
assert.match(workflow,/upload-artifact/u);
assert.doesNotMatch(workflow,/record-[123]:/u);
assert.doesNotMatch(workflow,/record-security-findings\.mjs/u);
assert.doesNotMatch(workflow,/gh\s+(api|workflow\s+run)/u);
assert.doesNotMatch(workflow,/PEER_WAKE/u);
assert.doesNotMatch(workflow,/git\s+push/iu);
assert.doesNotMatch(workflow,/git\s+switch\s+--create/iu);
assert.doesNotMatch(workflow,/pull_request_target:/u);
assert.match(registryText,/scripts\/security\/security-red-team-runner\.mjs/u);
assert.match(registryText,/docs\/agents\/SECURITY-RED-TEAM-BOTS\.json/u);
assert.match(registryText,/\.github\/workflows\/security-red-team\.yml/u);

const runner = fs.readFileSync(path.join(root,'scripts/security/security-red-team-runner.mjs'),'utf8');
assert.match(runner,/git ls-files -z/u);
assert.match(runner,/const appSourceFile = \(file\) => sourceFile\(file\) && !workflowFile\(file\);/u);
assert.match(runner,/mutationAuthority:false/u);
assert.match(runner,/adversarial-repair-twin\.mjs/u);

console.log(JSON.stringify({
  status:'PASS',
  protocol:registry.protocol,
  bots:Object.keys(registry.bots),
  isolation:registry.execution.isolation,
  evidenceOutput:registry.execution.evidenceOutput
},null,2));
