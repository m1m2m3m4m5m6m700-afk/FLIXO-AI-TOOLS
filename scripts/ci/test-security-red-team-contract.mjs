#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root,'docs/agents/SECURITY-RED-TEAM-BOTS.json'),'utf8'));
const workflow = fs.readFileSync(path.join(root,'.github/workflows/security-red-team.yml'),'utf8');
const registryText = fs.readFileSync(path.join(root,'scripts/ci/control-plane-registry.mjs'),'utf8');

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
assert.equal(registry.execution.isolation.workflowTrigger,'AUTOMATIC_PUSH_AND_MANUAL_DISPATCH');
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
assert.equal(registry.execution.uncertaintyModel.enabled,true);
assert.equal(registry.execution.uncertaintyModel.version,'EPISTEMIC-UNCERTAINTY-v1');
assert.equal(registry.execution.uncertaintyModel.method,'STATIC_RULE_MATCH_STRENGTH');
assert.equal(registry.execution.uncertaintyModel.humanSupervisorRequired,true);
assert.equal(registry.execution.allAgentSweep.enabled,true);
assert.equal(registry.execution.allAgentSweep.scope,'ALL_200_CANONICAL_COGNITIVE_IDENTITIES');
assert.equal(registry.execution.allAgentSweep.script,'scripts/security/security-red-team-all-agents.mjs');
assert.equal(registry.execution.allAgentSweep.mutationAuthority,false);
assert.equal(registry.execution.allAgentSweep.certificationAuthority,false);
assert.equal(registry.execution.allAgentSweep.greenAuthority,false);


assert.match(workflow,/workflow_dispatch:/u);
assert.match(workflow,/expected_sha:[\s\S]*required:\s*true/u);
assert.match(workflow,/EXPECTED_SHA:\s*\$\{\{\s*inputs\.expected_sha\s*\|\|\s*github\.sha\s*\}\}/u);
assert.match(workflow,/push:\s*\n\s*branches:\s*\[execution\]/u);
assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/u);
assert.doesNotMatch(workflow,/actions:\s+write/u);
assert.match(workflow,/strategy:[\s\S]*matrix:[\s\S]*SECURITY-REDTEAM-1[\s\S]*SECURITY-REDTEAM-2[\s\S]*SECURITY-REDTEAM-3/u);
assert.match(workflow,/persist-credentials:\s*false/u);
assert.match(workflow,/Fail closed unless expected SHA is the live execution head/u);
assert.match(workflow,/gh api "repos\/\$GITHUB_REPOSITORY\/git\/ref\/heads\/execution"/u);
assert.match(workflow,/LIVE_EXECUTION_SHA="\$\(gh api/u);
assert.match(workflow,/security-red-team-runner\.mjs/u);
assert.match(workflow,/FLIXO_TWIN_READ_ONLY:\s*"true"/u);
assert.match(workflow,/FLIXO_TWIN_DETACHED:\s*"true"/u);
assert.match(workflow,/mutationAuthority\s*==\s*false/u);
assert.match(workflow,/upload-artifact/u);
assert.match(workflow,/agent-sweep:/u);
assert.match(workflow,/security-red-team-all-agents\.mjs/u);
assert.match(workflow,/All 200 Agents/u);
assert.match(workflow,/persist-credentials:\s*false/u);
assert.doesNotMatch(workflow,/actions:\s+write/u);
const allAgentsRunner = fs.readFileSync(path.join(root,'scripts/security/security-red-team-all-agents.mjs'),'utf8');
assert.match(allAgentsRunner,/FLIXO-REDTEAM-ALL-AGENTS-v1/u);
assert.match(allAgentsRunner,/agentCount:agents\.length/u);
assert.match(allAgentsRunner,/cognitiveBotIds/u);
assert.match(allAgentsRunner,/ONE_CANONICAL_MEMORY/u);
assert.match(allAgentsRunner,/mutationAuthority:false/u);
assert.match(allAgentsRunner,/certificationAuthority:false/u);
assert.match(allAgentsRunner,/ADVERSARIAL/u);

assert.match(workflow,/Evaluate actionable findings and request automated repair/u);
assert.match(workflow,/REDTEAM_REPAIR_REQUIRED=true/u);
assert.match(workflow,/\.confidence >= 0\.90/u);
assert.match(workflow,/severity == "CRITICAL" or \.severity == "HIGH"/u);
assert.doesNotMatch(workflow,/record-[123]:/u);
assert.doesNotMatch(workflow,/record-security-findings\.mjs/u);
assert.doesNotMatch(workflow,/gh\s+workflow\s+run/u);
assert.doesNotMatch(workflow,/PEER_WAKE/u);
assert.doesNotMatch(workflow,/git\s+push/iu);
assert.doesNotMatch(workflow,/git\s+switch\s+--create/iu);
assert.doesNotMatch(workflow,/pull_request_target:/u);
assert.match(registryText,/scripts\/security\/security-red-team-runner\.mjs/u);
assert.match(registryText,/docs\/agents\/SECURITY-RED-TEAM-BOTS\.json/u);
assert.match(registryText,/\.github\/workflows\/security-red-team\.yml/u);

const runner = fs.readFileSync(path.join(root,'scripts/security/security-red-team-runner.mjs'),'utf8');
assert.match(runner,/execFileSync\(['"]git['"],\s*\['ls-files',\s*['"]-z['"]\]/u);
assert.match(runner,/git['"],\s*\['ls-remote',\s*['"]origin['"],\s*['"]refs\/heads\/execution['"]/u);
assert.match(runner,/SECURITY_RED_TEAM_STALE_SHA_REJECTED/u);
assert.match(runner,/const browserSourceFile =/u);
assert.match(runner,/SENSITIVE_PERMISSION_ALLOWLISTS/u);
assert.match(runner,/const allowlist = new Set\(SENSITIVE_PERMISSION_ALLOWLISTS\[permission\] \?\? \[\]\)/u);
assert.match(runner,/const explicitlyAdmitted = allowlist\.has\(workflow\)/u);
assert.match(runner,/if \(explicitlyAdmitted\) continue/u);
assert.match(runner,/const browserSourceFile =/u);
assert.match(runner,/\^src\\\/(?:server|.*\\\/server)/u);
assert.match(runner,/(?:__tests__|tests|test-fixtures)/u);
assert.equal((runner.match(/tracked\.filter\(browserSourceFile\)/gu) ?? []).length,2);
assert.doesNotMatch(runner,/tracked\.filter\(appSourceFile\)\s*\{\n\s*const checks = \[\n\s*\['RUNTIME-FETCH-TAINT'/u);
assert.match(runner,/mutationAuthority:false/u);
assert.match(runner,/APP-CHILD-PROCESS/u);
const runtime2Start = runner.indexOf("if (BOT_ID === 'SECURITY-REDTEAM-2')");
const runtime3Start = runner.indexOf("if (BOT_ID === 'SECURITY-REDTEAM-3')");
assert.ok(runtime2Start >= 0 && runtime3Start > runtime2Start);
const runtime2 = runner.slice(runtime2Start, runtime3Start);
const runtime3 = runner.slice(runtime3Start);
assert.doesNotMatch(runtime2,/trustedStaticRedirectTargets|sameOriginPath|publicViteEndpoint|findingSeverity = 'MEDIUM'/u);
assert.match(runtime3,/trustedStaticRedirectTargets/u);
assert.match(runtime3,/sameOriginPath/u);
assert.match(runtime3,/publicViteEndpoint/u);
assert.match(runtime3,/findingSeverity = 'MEDIUM'/u);
assert.match(runner,/trustedStaticRedirectTargets/u);
assert.match(runner,/publicViteEndpoint/u);
assert.match(runner,/sameOriginPath/u);
assert.match(runner,/findingSeverity = 'MEDIUM'/u);
assert.match(runner,/(?:node:)?child_process/u);
assert.ok(runner.includes("(?<!\\.)\\bexec\\s*\\("));
assert.doesNotMatch(runner,/child_process\|execFileSync/u);
assert.match(runner,/adversarial-repair-twin\.mjs/u);
assert.match(runner,/test-canonical-chain-red-team-v2\.mjs/u);
assert.match(runner,/CANONICAL_CHAIN_FALSE_GREEN/u);
assert.match(fs.readFileSync(path.join(root,'scripts/ci/test-canonical-chain-red-team-v2.mjs'),'utf8'),/FLIXO-CANONICAL-CHAIN-REDTEAM-v2/u);
assert.match(fs.readFileSync(path.join(root,'scripts/ci/test-canonical-chain-red-team-v2.mjs'),'utf8'),/POST_VALIDATION_PLAYWRIGHT_REPORT_RACE/u);
assert.match(fs.readFileSync(path.join(root,'scripts/ci/validate-execution-graph.mjs'),'utf8'),/source Playwright report hash mismatch/u);
assert.match(fs.readFileSync(path.join(root,'scripts/ci/validate-execution-graph.mjs'),'utf8'),/unit\.status !== 'PASS'/u);
assert.match(runner,/uncertainty:/u);
assert.match(runner,/uncertaintyLevel/u);
assert.match(runner,/NO_FINDINGS_OBSERVED/u);

console.log(JSON.stringify({
  status:'PASS',
  protocol:registry.protocol,
  bots:Object.keys(registry.bots),
  isolation:registry.execution.isolation,
  evidenceOutput:registry.execution.evidenceOutput
},null,2));
