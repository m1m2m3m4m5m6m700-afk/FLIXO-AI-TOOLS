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

const lint = 'Run 35012345678 failed: src/lib/agent/execution-observability.ts:42:3 abcdefabcdefabcdefabcdefabcdefabcdefabcd no-unused-vars';
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
assert.equal(repairPolicy.maxAttemptsPerFingerprint, 2_000_000);
assert.equal(repairPolicy.maxRepairChainRuns, 2_000_000);
assert.equal(repairPolicy.maxChangedFiles, 8);
assert.equal(repairPolicy.maxChangedLines, 300);
assert.equal(repairPolicy.openDraftPrOnly, false);
assert.equal(fs.existsSync('diagnostics/auto-repair/action-vault/ACTION-RESIDENCY-POLICY.json'), true);
const actionResidencyPolicy = JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-RESIDENCY-POLICY.json','utf8'));
assert.equal(actionResidencyPolicy.residency.alwaysResident, true);
assert.equal(actionResidencyPolicy.residency.leaveVault, false);
assert.equal(actionResidencyPolicy.residency.taskMustRemainOpenUntil, 'CANONICAL_GREEN');
assert.equal(actionResidencyPolicy.operations.maxOperationsPerBot, 2_000_000);
assert.equal(actionResidencyPolicy.automaticVisits.visitsPerBotPerDay, 3);
assert.equal(actionResidencyPolicy.automaticVisits.totalAutomaticVisitsPerDay, 9);
assert.equal(actionResidencyPolicy.escalation.thresholdAfterFailedAttempts, 20);
assert.equal(actionResidencyPolicy.escalation.triggerOnNextRetryAttempt, 21);
assert.equal(actionResidencyPolicy.escalation.recipient, 'assistantController');
assert.equal(actionResidencyPolicy.escalation.taskRemainsOpen, true);
assert.equal(actionResidencyPolicy.escalation.continueRepairAfterEscalation, true);
const actionSquadRegistry = JSON.parse(fs.readFileSync('docs/agents/ACTION-REPAIR-SQUAD-REGISTRY.json','utf8'));
const actionIntelligenceProfile = JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json','utf8'));
const primaryIntelligence = actionIntelligenceProfile.roleMatrix['ACTION-REPAIR'].intelligenceCapabilities || actionIntelligenceProfile.roleMatrix['ACTION-REPAIR'].capabilities;
const twinIntelligence = actionIntelligenceProfile.roleMatrix['ACTION-REPAIR-2'].intelligenceCapabilities || actionIntelligenceProfile.roleMatrix['ACTION-REPAIR-2'].capabilities;
assert.deepEqual([...primaryIntelligence].sort(), [...twinIntelligence].sort());
assert.equal(actionIntelligenceProfile.parity.programmerTwinIntelligenceEqual, true);
assert.equal(actionIntelligenceProfile.roleMatrix['ACTION-REPAIR-2'].mutationAuthority, 'VERIFIER_ONLY_NO_DIRECT_SOURCE_MUTATION');
assert.equal(actionSquadRegistry.pairedRepairControl?.binding?.verifierChallengeRequired, true);
assert.equal(actionSquadRegistry.pairedRepairControl?.binding?.verifierProofArtifact, 'action-repair-2-proposal.json');
assert.equal(actionSquadRegistry.pairedRepairControl?.assistant?.verifierMode?.fallbackExecutor, 'assistantRepairAgent');
assert.equal(actionSquadRegistry.pairedRepairControl?.assistant?.verifierMode?.fallbackRequiresPrimaryApproval, true);
assert.equal(actionSquadRegistry.threeBotCollaboration?.proofGate?.mutationBlockedWithoutProof, true);
assert.equal(actionSquadRegistry.threeBotCollaboration?.proofGate?.programmerTwinParityRequired, true);
assert.equal(actionSquadRegistry.programmerTwin?.intelligenceParity, 'EXACT');
assert.equal(actionSquadRegistry.threeBotCollaboration?.cognitiveAwarenessGate?.enabled, true);
assert.equal(actionIntelligenceProfile.cognitiveExpansion?.enabled, true);
assert.equal(actionIntelligenceProfile.cognitiveExpansion?.roleScope, 'COGNITIVE_SCOPE_EXPANDS; AUTHORITY_SCOPE_DOES_NOT');
assert.equal(actionSquadRegistry.threeBotCollaboration?.proofGate?.alternativesRequired, true);
assert.equal(actionSquadRegistry.threeBotCollaboration?.proofGate?.falsificationChecksRequired, true);
const autoRepairWorkflow = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const dailyGateWorkflow = fs.readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
const handoffGateWorkflow = fs.readFileSync('.github/workflows/agent-repair-handoff-gate.yml', 'utf8');
assert.doesNotMatch(autoRepairWorkflow, /workflow_run:/);
assert.match(autoRepairWorkflow, /adversarial_twin:/);
assert.match(autoRepairWorkflow, /Await the parallel adversarial twin/);
assert.match(autoRepairWorkflow, /TWIN_A_READY=true/);
assert.match(autoRepairWorkflow, /TWIN_B_READY=true/);
assert.match(autoRepairWorkflow, /FLIXO_TWIN_A_PATH/);
assert.match(autoRepairWorkflow, /FLIXO_TWIN_B_PATH/);
assert.match(autoRepairWorkflow, /Enforce divergent twin decision before mutation/);
assert.match(autoRepairWorkflow, /TWIN_DECISION_GATE=PASS/);
assert.match(autoRepairWorkflow, /CELL-005 select best repair option/);
assert.match(autoRepairWorkflow, /gh\s+workflow\s+run\s+auto-repair\.yml/i);
const dualControlSource = fs.readFileSync('scripts/ci/action-repair-dual-control.mjs','utf8');
assert.match(dualControlSource, /ACTION_PAIR_ADVERSARIAL_CHALLENGE_FAILED/);
assert.match(dualControlSource, /alternativeHypotheses/);
assert.match(dualControlSource, /falsificationChecks/);
assert.match(dualControlSource, /counterEvidence/);
assert.match(dualControlSource, /ACTION_PAIR_APPROVAL_REQUIRES_VERIFIED_CHALLENGE/);
assert.match(dualControlSource, /EXACT_PROGRAMMER_TWIN_VERIFIER/);
assert.match(dualControlSource, /ACTION_PAIR_PROGRAMMER_TWIN_PARITY_REQUIRED/);
assert.match(autoRepairWorkflow, /FLIXO_ACTION_VAULT_VERIFIER_PROOF_PATH: \/tmp\/action-repair-2-proposal\.json/);
assert.match(autoRepairWorkflow, /ACTION_VAULT_VERIFIER_APPROVED_EXACT_SHA/);
assert.match(autoRepairWorkflow, /Verify exact ACTION-REPAIR \/ ACTION-REPAIR-2 programmer intelligence parity/);
assert.match(autoRepairWorkflow, /FLIXO_ACTION_REPAIR_TWIN_PARITY_PATH/);
assert.match(autoRepairWorkflow, /Build Action Vault system cognitive awareness — shared context gate/);
assert.match(autoRepairWorkflow, /--primary-proof="\$FLIXO_PRIMARY_CORRECTNESS_PROOF_PATH"/);
assert.match(autoRepairWorkflow, /--awareness="\$FLIXO_SYSTEM_COGNITIVE_AWARENESS_PATH"/);
const markIndex=autoRepairWorkflow.indexOf('Mark mutation boundary after verifier dual-control');
const auditIndex=autoRepairWorkflow.indexOf('ACTION-REPAIR-2 adversarial falsification of ACTION-REPAIR correctness proof');
assert.match(autoRepairWorkflow,/Build Action Vault system cognitive awareness — shared context gate/);
assert.match(autoRepairWorkflow,/ACTION-REPAIR primary correctness proof — constructive proof gate/);
assert.match(autoRepairWorkflow,/ACTION-REPAIR-2 adversarial falsification of ACTION-REPAIR correctness proof/);
assert.match(autoRepairWorkflow,/FLIXO_SYSTEM_COGNITIVE_AWARENESS_PATH/);
assert.ok(markIndex>auditIndex, 'MUTATING state must be opened only after verifier audit/approval');
assert.match(autoRepairWorkflow, /CURRENT_TARGET_SHA=/);
assert.match(autoRepairWorkflow, /Create exact unpublished candidate commit/);
assert.match(autoRepairWorkflow, /test "\$BASE_SHA" = "\$FAILED_SHA"/);
assert.match(autoRepairWorkflow, /test "\$\(git rev-parse origin\/execution\)" = "\$FAILED_SHA"/);
assert.match(autoRepairWorkflow, /CANDIDATE_SHA="\$\(git rev-parse HEAD\)/);
assert.match(autoRepairWorkflow, /PARENT_SHA="\$\(git rev-parse "\$CANDIDATE_SHA\^"\)/);
assert.match(autoRepairWorkflow, /Run targeted regression and post-patch adversarial falsification in parallel/);
assert.match(autoRepairWorkflow, /FLIXO_EXPECTED_TARGET_SHA="\$CANDIDATE_SHA" FLIXO_PATCH_BASE_SHA="\$PARENT_SHA"/);
assert.match(autoRepairWorkflow, /test "\$\(git rev-parse origin\/execution\)" = "\$PARENT_SHA"/);
assert.doesNotMatch(autoRepairWorkflow, /git\s+push[^\n]*\bexecution\b/);
assert.match(autoRepairWorkflow, /CHAIR_GUARD_BLOCKED: direct execution publication is forbidden/);
assert.match(autoRepairWorkflow, /EXECUTION_PUBLICATION=BLOCKED_BY_CHAIR_GUARD/);
assert.match(autoRepairWorkflow, /EVIDENCE_CAPTURE=FAILED/);
assert.match(autoRepairWorkflow, /CONTROLLER_SHA="\$MAIN_SHA"/);
assert.match(autoRepairWorkflow, /persist-credentials:\s*false/);
assert.match(autoRepairWorkflow, /TRUST_MODEL=MAIN_CONTROLLER_EXECUTION_TARGET/);
assert.match(autoRepairWorkflow, /FLIXO_TRUSTED_CONTROLLER_SHA=\$CONTROLLER_SHA/);
assert.match(dailyGateWorkflow, /actions\/workflows\/auto-repair\.yml\/dispatches/);
assert.doesNotMatch(dailyGateWorkflow, /workflow_run:/);
assert.match(dailyGateWorkflow, /group:\s*flixo-continuous-error-watch-\$\{\{\s*github\.run_id\s*\}\}/);
assert.match(dailyGateWorkflow, /cancel-in-progress:\s*false/);
assert.match(dailyGateWorkflow, /const observedBranch = read\('\/tmp\/flixo-watch\/observed-branch'\)\.trim\(\);/);
assert.match(dailyGateWorkflow, /observedBranch,/);
assert.match(dailyGateWorkflow, /- FLIXO WP0 Trust Baseline\n\s+- FLIXO Test Impact\n\s+- FLIXO Test Impact Execution/);
assert.match(dailyGateWorkflow, /- Repository Security Baseline\n\s+- Claude Security Review/);
assert.doesNotMatch(dailyGateWorkflow, /gh\s+workflow\s+run\s+execution-bot-watchdog\.yml/i);
assert.match(handoffGateWorkflow, /branches: \[execution\]/);
assert.match(handoffGateWorkflow, /test "\$REPAIR_TARGET_BRANCH" = "execution"/);
assert.match(dailyGateWorkflow, /CURRENT_EXECUTION_SHA=.*git\/ref\/heads\/execution/);
assert.match(autoRepairWorkflow, /Initialize Repair Control Plane cycle/);
assert.match(autoRepairWorkflow, /to=EVIDENCE_LOCKED/);
assert.match(autoRepairWorkflow, /to=RCA/);
assert.match(autoRepairWorkflow, /to=REPAIR_PLANNED/);
assert.match(autoRepairWorkflow, /to=MUTATING/);
assert.match(autoRepairWorkflow, /to=LOCAL_VERIFICATION/);
assert.match(autoRepairWorkflow, /to=PUBLISHED_TO_EXECUTION/);
assert.match(autoRepairWorkflow, /to=CANONICAL_CI/);
assert.match(dailyGateWorkflow, /failure_fingerprint=\\$FAILURE_FINGERPRINT/);
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

const supervisorWorkflow = fs.readFileSync('.github/workflows/agent-repair-supervisor.yml', 'utf8');
assert.doesNotMatch(supervisorWorkflow, /push:/);
assert.doesNotMatch(supervisorWorkflow, /pull_request:/);
assert.doesNotMatch(supervisorWorkflow, /gh workflow run auto-repair\.yml/);
assert.match(supervisorWorkflow, /DISPATCH_AUTHORITY=CANONICAL_REPAIR_GATE_ONLY/);
assert.match(supervisorWorkflow, /permissions:[\\s\\S]*contents: read/);

assert.match(autoRepairWorkflow,/noDirectPushByExecutor:true/);
assert.match(autoRepairWorkflow,/READY_FOR_CHAIR_PUBLICATION/);
assert.doesNotMatch(autoRepairWorkflow,/gh api .*git\/refs.*PATCH/);
assert.doesNotMatch(autoRepairWorkflow,/cp \/tmp\/flixo-repair-memory\.json diagnostics\/auto-repair\/memory\.json/);
const chairAuditScript=fs.readFileSync('scripts/ci/auto-repair-chair1-audit.mjs','utf8');
assert.match(chairAuditScript,/INDEPENDENT_CHAIR_APPROVAL_MISSING/);
assert.match(chairAuditScript,/INDEPENDENT_CHAIR_APPROVAL_SIGNATURE_INVALID/);
