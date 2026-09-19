import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerprintFailure, normalizeFailure } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { isPathAllowed, isProtectedPath, repairPolicy } from './auto-repair-policy.mjs';
import { shouldReopenExternalRepairCycle, superviseExternalRepairCycle } from './auto-repair-supervisor.mjs';

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
const watchdogWorkflow = fs.readFileSync('.github/workflows/execution-bot-watchdog.yml', 'utf8');
const dailyGateWorkflow = fs.readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
const mergeGateWorkflow = fs.readFileSync('.github/workflows/auto-repair-merge-gate.yml', 'utf8');
assert.doesNotMatch(autoRepairWorkflow, /workflow_run:/);
assert.doesNotMatch(autoRepairWorkflow, /gh\s+workflow\s+run\s+auto-repair\.yml/i);
assert.match(watchdogWorkflow, /gh\s+workflow\s+run\s+auto-repair\.yml[\s\S]*--ref execution/i);
assert.match(dailyGateWorkflow, /gh\s+workflow\s+run\s+execution-bot-watchdog\.yml[\s\S]*--ref execution/i);
assert.doesNotMatch(dailyGateWorkflow, /gh\s+workflow\s+run\s+auto-repair\.yml/i);
assert.doesNotMatch(mergeGateWorkflow, /gh\s+pr\s+merge/i);
assert.doesNotMatch(mergeGateWorkflow, /--squash|--rebase|--merge(?:\s|")/i);
assert.match(mergeGateWorkflow, /gh api --method PATCH[\s\S]*git\/refs\/heads\/main/);
assert.match(mergeGateWorkflow, /-F "force=false"/);
assert.match(mergeGateWorkflow, /MAIN_AFTER=.*EXPECTED_SHA/);
assert.match(mergeGateWorkflow, /POST_PROMOTION_EXACT_SHA_PROOF=true/);
assert.match(mergeGateWorkflow, /commits\/\$EXPECTED_SHA\/status/);
assert.match(mergeGateWorkflow, /VERCEL_STATE=/);
assert.match(mergeGateWorkflow, /test "\$VERCEL_STATE" = "success"/);

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
for (const path of [
  '.github/workflows/auto-repair-executor.yml',
  '.github/workflows/auto-repair-merge-gate.yml',
  '.github/workflows/execution-sync.yml',
  '.github/workflows/wp0-trust-baseline.yml',
  'scripts/ci/auto-repair-policy.mjs',
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/auto-repair-learning.mjs',
  'scripts/ci/auto-repair-supervisor.mjs',
  'scripts/ci/auto-repair/',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repository-security-baseline.mjs',
  'scripts/ci/validate-auto-repair-memory.mjs',
]) {
  assert.equal(isPathAllowed(path), false, `trust perimeter must remain immutable to auto-repair: ${path}`);
}
console.log('AUTO_REPAIR_FINAL_ARCHITECTURE=PASS');
