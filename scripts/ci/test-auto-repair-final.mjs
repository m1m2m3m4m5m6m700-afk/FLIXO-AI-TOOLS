import { REPAIR_GATE_AUTOMATION, HISTORICAL_REPAIR_WORKFLOWS, TRUST_PERIMETER_PATHS } from './control-plane-registry.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerprintFailure, normalizeFailure } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { isPathAllowed, isProtectedPath, repairPolicy } from './auto-repair-policy.mjs';
import { shouldReopenExternalRepairCycle, superviseExternalRepairCycle } from './auto-repair-supervisor.mjs';
import { critiqueRepair } from './auto-repair/self-critic.mjs';
import { buildCausalProof } from './auto-repair/causal-proof.mjs';
import { buildRepairKnowledgeGraph } from './auto-repair/knowledge-graph.mjs';

const lint = 'Run 35012345678 failed: abcdefabcdefabcdefabcdefabcdefabcdefabcd no-unused-vars';
assert(!normalizeFailure(lint).includes('35012345678'));
assert.equal(fingerprintFailure(lint), fingerprintFailure(lint));
const plan = planRepair(lint);
assert.equal(plan.selected.id, 'eslint-unused');
assert.equal(confidenceGate({ selected: plan.selected, features: plan.features }).allowed, true);
assert.equal(selectSpecialist(plan.features).id, 'eslint-specialist');
assert.equal(planRepair('webkit waitForGpuRender timeout').selected, null);
assert.equal(planRepair('certification FAST 66 DEEP 60').selected, null);
assert.equal(isPathAllowed('.github/workflows/ci.yml'), false);
assert.equal(isProtectedPath('tests/seed.spec.ts'), true);
assert.equal(isPathAllowed('src/example.ts'), true);
assert.equal(repairPolicy.maxAttemptsPerFingerprint, 3);
assert.equal(repairPolicy.maxRepairChainRuns, 8);
assert.equal(repairPolicy.maxChangedFiles, 8);
assert.equal(repairPolicy.maxChangedLines, 300);
assert.equal(repairPolicy.openDraftPrOnly, false);
const autoRepairWorkflow = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const dailyGateWorkflow = fs.readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
const handoffGateWorkflow = fs.readFileSync('.github/workflows/agent-repair-handoff-gate.yml', 'utf8');
assert.doesNotMatch(autoRepairWorkflow, /workflow_run:/);
assert.doesNotMatch(autoRepairWorkflow, /gh\s+workflow\s+run\s+auto-repair\.yml/i);
assert.match(autoRepairWorkflow, /CURRENT_TARGET_SHA=/);
assert.match(autoRepairWorkflow, /EVIDENCE_CAPTURE=FAILED/);
assert.match(autoRepairWorkflow, /CONTROLLER_SHA="\$MAIN_SHA"/);
assert.match(autoRepairWorkflow, /persist-credentials:\s*false/);
assert.match(autoRepairWorkflow, /TRUST_MODEL=MAIN_CONTROLLER_EXECUTION_TARGET/);
assert.match(autoRepairWorkflow, /FLIXO_TRUSTED_CONTROLLER_SHA=\$CONTROLLER_SHA/);
assert.match(dailyGateWorkflow, /gh\s+workflow\s+run\s+auto-repair\.yml[\s\S]*--ref execution/i);
assert.match(dailyGateWorkflow, /workflow_run:[\s\S]*workflows:\s*\n\s+- FLIXO Test System/);
assert.doesNotMatch(dailyGateWorkflow, /- FLIXO WP0 Trust Baseline\n\s+- FLIXO Test Impact/);
assert.doesNotMatch(dailyGateWorkflow, /gh\s+workflow\s+run\s+execution-bot-watchdog\.yml/i);
assert.match(handoffGateWorkflow, /branches: \[execution\]/);
assert.match(handoffGateWorkflow, /CURRENT_EXECUTION_SHA=/);
assert.match(handoffGateWorkflow, /HANDOFF_EXECUTION_SHA/);


const externalLog = [
  'COPILOT_AGENT_MODEL: sweagent-capi:claude-opus-5[ReasoningEffort=medium]',
  'COPILOT_API_URL: https://api.individual.githubcopilot.com',
  'Error creating PR review request: SessionModelError: Execution failed: CAPIError: 400 The requested model is not supported.',
].join('\n');
const supervised = superviseExternalRepairCycle({
  log: externalLog,
  memory: { version: 9, cases: [] },
});
assert.equal(supervised.reopen, true);
assert.equal(Boolean(supervised.providerSignature), true);
const learnedBlock = {
  fingerprint: supervised.fingerprint,
  cases: [{
    fingerprint: supervised.fingerprint,
    outcomes: [{
      outcome: 'blocked-external',
      provenance: { providerSignature: supervised.providerSignature },
    }],
  }],
};
const suppressed = shouldReopenExternalRepairCycle(learnedBlock, {
  fingerprint: supervised.fingerprint,
  providerSignature: supervised.providerSignature,
});
assert.equal(suppressed.reopen, false);
const changedProvider = shouldReopenExternalRepairCycle(learnedBlock, {
  fingerprint: supervised.fingerprint,
  providerSignature: 'different-provider-signature',
});
assert.equal(changedProvider.reopen, true);
assert.equal(new Set(REPAIR_GATE_AUTOMATION).size, REPAIR_GATE_AUTOMATION.length);
assert.equal(new Set(HISTORICAL_REPAIR_WORKFLOWS).size, HISTORICAL_REPAIR_WORKFLOWS.length);
for (const path of TRUST_PERIMETER_PATHS) {
  assert.equal(isPathAllowed(path), false, `trust perimeter must remain immutable to auto-repair: ${path}`);
}
console.log('AUTO_REPAIR_FINAL_ARCHITECTURE=PASS');

const criticPass=critiqueRepair({diff:'--- a/src/example.ts\\n+++ b/src/example.ts\\n@@\\n-const x = 1;\\n+const x = 2;\\n',diffSummary:{files:['src/example.ts'],lines:2},plan:{id:'eslint-unused',file:'src/example.ts',targetScope:'exact-file'},diagnosis:{location:{file:'src/example.ts'}},simulation:{ok:true}});
assert.equal(criticPass.ok,true);
const criticBlock=critiqueRepair({diff:'+test.skip();\\n',diffSummary:{files:['src/example.ts'],lines:1},plan:{id:'eslint-unused',file:'src/example.ts',targetScope:'exact-file'},simulation:{ok:true}});
assert.equal(criticBlock.ok,false);
const causal=buildCausalProof({diagnosis:{causalConfidence:0.92,secondHypothesis:null,mutationGate:{hypothesisSeparation:true},location:{file:'src/example.ts'}},plan:{file:'src/example.ts'},simulation:{ok:true},reproductionBefore:{ok:false,results:[{ok:false}]},reproductionAfter:{ok:true,results:[{ok:true}]},regression:{ok:true},recurrenceProof:{firstPass:true,secondPass:true},changedPaths:['src/example.ts'],selfCritic:{ok:true}});
assert.equal(causal.ok,true);
const graph=buildRepairKnowledgeGraph({fingerprint:fingerprintFailure('example failure'),targetSha:'a'.repeat(40),diagnosis:{rootCause:'lint'},plan:{id:'eslint-unused',file:'src/example.ts'},simulation:{ok:true,reason:'SIMULATION_PASS'},selfCritic:{ok:true,verdict:'ACCEPT'},causalProof:causal});
assert.equal(graph.valid,true);
assert.equal(graph.nodes.length,8);
