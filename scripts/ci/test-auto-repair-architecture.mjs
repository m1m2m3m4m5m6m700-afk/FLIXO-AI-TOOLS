import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INTRACTABLE_THRESHOLD, MEMORY_VERSION, fingerprintFailure, normalizeFailure, rankLessons } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { isPathAllowed, isProtectedPath, repairPolicy } from './auto-repair-policy.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { impactedTests } from './auto-repair/reproduction.mjs';
import { summarizeDiff } from './auto-repair/evidence.mjs';
import { runRegression } from './auto-repair/regression.mjs';
import { snapshot } from './auto-repair/rollback.mjs';
import { runAstRepair } from './auto-repair/ast-repair.mjs';
import { validateRepairProof, preventionRuleFor, escalationReason } from './auto-repair-proof.mjs';

const workflow = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
assert.match(workflow, /workflow_run:\s*\n\s*workflows:/);
assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'failure'/);
assert.match(workflow, /CURRENT_MAIN_SHA/);
assert.match(workflow, /CURRENT_FAILURE_ID/);
assert.match(workflow, /Repair remains open/);
assert.match(workflow, /gh workflow run auto-repair\.yml/);
assert.match(workflow, /cancel-in-progress: false/);

const sample = 'Run 35012345678 failed: src/example.ts:10:3 no-unused-vars';
const normalized = normalizeFailure(sample);
assert(!normalized.includes('35012345678'));
assert(!normalized.includes('abcdefabcdefabcdefabcdefabcdefabcdefabcd'));
assert.equal(fingerprintFailure(sample), fingerprintFailure(sample));
const plan = planRepair(sample);
assert.equal(plan.selected?.id, 'eslint-file');
assert.equal(confidenceGate({ selected: plan.selected, features: plan.features }).allowed, true);
assert.equal(plan.selected?.file, 'src/example.ts');
assert.equal(selectSpecialist(plan.features).id, 'eslint-specialist');
assert.deepEqual(impactedTests(['lint']), [['npm', ['run', 'lint']]]);
assert.equal(summarizeDiff('diff --git a/src/a.ts b/src/a.ts\n+new\n-old\n').files.length, 1);
assert.equal(typeof runRegression, 'function');
assert.equal(typeof snapshot, 'function');
assert.equal(runAstRepair(null, { id: 'unsupported' }).applied, false);
assert.equal(isPathAllowed('.github/workflows/ci.yml'), false);
assert.equal(isProtectedPath('tests/seed.spec.ts'), true);
assert.equal(isPathAllowed('src/example.ts'), true);
assert.equal(repairPolicy.maxChangedFiles, 8);
assert.equal(repairPolicy.maxChangedLines, 300);
assert.equal(repairPolicy.maxAttemptsPerFingerprint, INTRACTABLE_THRESHOLD);
assert.equal(MEMORY_VERSION, 7);
assert.equal(INTRACTABLE_THRESHOLD, 3);
assert.equal(planRepair('webkit waitForGpuRender timeout').selected, null);
assert.equal(planRepair('typescript TS2322 type error').selected, null);
assert.equal(planRepair('certification FAST 66 DEEP 60').selected, null);
const externalPlan = planRepair('SessionModelError: CAPIError: 400 The requested model is not supported');
assert.equal(externalPlan.selected, null);
assert(externalPlan.features.includes('external-tooling'));

const proofInput = {
  targetSha: 'a'.repeat(40),
  changedPaths: ['src/example.ts'],
  diff: { files: ['src/example.ts'], lines: 2 },
  regression: { ok: true },
};
const goodProof = validateRepairProof({
  evidence: proofInput,
  rootCauseProof: { reproductionWasFailing: true, reproductionRecovered: true, regressionPassed: true, commandsPresent: true },
  recurrenceProof: { required: true, firstPass: true, secondPass: true },
});
assert.equal(goodProof.ok, true);
assert.deepEqual(goodProof.failures, []);
const badProof = validateRepairProof({
  evidence: proofInput,
  rootCauseProof: { reproductionWasFailing: true, reproductionRecovered: false, regressionPassed: true, commandsPresent: true },
  recurrenceProof: { required: true, firstPass: true, secondPass: false },
});
assert.equal(badProof.ok, false);
assert(badProof.failures.includes('root-cause-proof-reproductionRecovered'));
assert(badProof.failures.includes('recurrence-proof-second-pass'));
assert.match(preventionRuleFor({ fingerprint: 'abc', rule: 'eslint-unused' }), /abc/);
assert.match(escalationReason(badProof), /^repair-proof-incomplete:/);

const learnedFingerprint = fingerprintFailure('eslint no-unused-vars');
const ranked = rankLessons({
  version: 7,
  cases: [],
  playbooks: [],
  lessons: [{ id: 'good', fingerprint: learnedFingerprint, rootCause: 'eslint-specialist', rule: 'eslint-unused', confidence: 1 }],
  antiLessons: [{ id: 'bad', fingerprint: learnedFingerprint, rootCause: 'eslint-specialist', rule: 'eslint-unused', confidence: 1 }],
}, { fingerprint: learnedFingerprint });
assert.equal(ranked[0].anti, undefined);
assert.equal(ranked[0].rule, 'eslint-unused');
assert.equal(ranked.at(-1).anti, true);

const fingerprintSource = fs.readFileSync('scripts/ci/auto-repair/fingerprint.mjs', 'utf8');
assert.match(fingerprintSource, /external-tooling/);
assert.match(fingerprintSource, /format/);
const taskAgentSource = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
assert.match(taskAgentSource, /maxCycles: 3/);
assert.match(taskAgentSource, /maxPreparedFiles: 8/);
const learningSource = fs.readFileSync('scripts/ci/auto-repair-learning.mjs', 'utf8');
assert(!learningSource.includes('git/refs/heads/flixo-intractable/'));
assert(!learningSource.includes('flixo-intractable/'));
assert.match(learningSource, /MEMORY_VERSION = 7/);
assert.match(learningSource, /Math\.max\(parsed\.version, MEMORY_VERSION\)/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /MAX_REPAIR_CYCLES = 3/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /MAX_STALLED_REPAIR_CYCLES = 2/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /MAX_PREPARED_FILES = 8/);
console.log('AUTO_REPAIR_ARCHITECTURE_SELF_TEST=PASS');
