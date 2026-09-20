import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INTRACTABLE_THRESHOLD, MEMORY_VERSION, fingerprintFailure, normalizeFailure, rankLessons, hydrateActionHistory } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { isPathAllowed, isProtectedPath, repairPolicy } from './auto-repair-policy.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { impactedTests } from './auto-repair/reproduction.mjs';
import { summarizeDiff } from './auto-repair/evidence.mjs';
import { runRegression } from './auto-repair/regression.mjs';
import { snapshot } from './auto-repair/rollback.mjs';
import { runAstRepair } from './auto-repair/ast-repair.mjs';
import { buildRegressionSentinel, validateRepairProof, preventionRuleFor, escalationReason } from './auto-repair-proof.mjs';

const workflow = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const dispatcher = fs.readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
const handoff = fs.readFileSync('.github/workflows/agent-repair-handoff-gate.yml', 'utf8');
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
assert.match(workflow, /FLIXO_EXPECTED_TARGET_SHA/);
assert.match(workflow, /FLIXO_FAILURE_FINGERPRINT/);
assert.match(workflow, /flixo-failed-branch/);
assert.match(workflow, /Repair remains open/);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /Run exact-SHA read-only source scout/);
assert.match(workflow, /FLIXO_SCOUT_REPORT/);
assert.match(workflow, /SCOUT_SHA/);
assert.match(workflow, /test "\$SCOUT_SHA" = "\$CURRENT_SHA"/);
assert.match(workflow, /\/tmp\/flixo-scout-report\.json/);
assert.match(workflow, /DEEP_\[A-Z_\]+_MISSING/);
assert.match(workflow, /ENGINE_OUTCOME.*proposal-only/);
assert.match(workflow, /LEARNING_OUTCOME='proposed'/);
assert.doesNotMatch(workflow, /workflow_run:/);
assert.match(workflow, /CURRENT_TARGET_SHA=/);
assert.match(workflow, /EVIDENCE_CAPTURE=FAILED/);
assert.doesNotMatch(workflow, /github\.event\.workflow_run/);
assert.match(workflow, /gh workflow run auto-repair\.yml/);
assert.match(workflow, /DISPATCH AUTHORITY: Daily·FLIXO Green Gate/);
assert.match(workflow, /--branch="\$FLIXO_REPAIR_TARGET_BRANCH"/);
const supervisor = fs.readFileSync('.github/workflows/agent-repair-supervisor.yml', 'utf8');
assert.match(supervisor, /name: FLIXO Agent Repair Supervisor/);
assert.match(supervisor, /schedule:/);
assert.match(supervisor, /workflow_dispatch:/);
assert.match(supervisor, /permissions:/);
assert.match(supervisor, /actions: read/);
assert.doesNotMatch(supervisor, /actions: write/);
assert.doesNotMatch(supervisor, /gh workflow run auto-repair\.yml/);
assert.match(supervisor, /RED_OBSERVED/);
assert.match(workflow, /NON_GREEN_LEARNING_PERSISTENCE=ARTIFACT_ONLY/);
assert.match(workflow, /NON_GREEN_REPAIR_MAY_NOT_ADVANCE_EXECUTION_SHA/);
assert.match(workflow, /NON_GREEN_LEARNING_PUBLISH=DISABLED/);
assert.match(dispatcher, /schedule:/);
assert.match(dispatcher, /group: flixo-continuous-error-watch-\$\{\{ github\.run_id \}\}/);
assert.match(dispatcher, /cancel-in-progress: false/);
assert.match(dispatcher, /gh workflow run auto-repair\.yml/);
assert.match(dispatcher, /FLIXO Continuous Delivery/);
assert.match(dispatcher, /Repository Security Baseline/);
assert.match(dispatcher, /Test Impact Execution/);
assert(!dispatcher.includes('gh workflow run execution-bot-watchdog.yml'));
const heartbeat = fs.readFileSync('.github/workflows/agent-repair-heartbeat.yml', 'utf8');
assert.match(heartbeat, /daily-flixo-green-gate\.yml/);
assert.match(heartbeat, /CANONICAL_GREEN_GATE_WAKE_DISPATCHED/);
assert.match(heartbeat, /ACTIVE_GREEN_GATES/);
assert.doesNotMatch(heartbeat, /gh workflow run auto-repair\.yml/);
assert.match(handoff, /branches: \[execution, main\]/);
assert.match(handoff, /CURRENT_TARGET_SHA=/);
assert.match(handoff, /HANDOFF_TARGET_SHA/);
const classifierSource = fs.readFileSync('scripts/ci/auto-repair-classifier.mjs', 'utf8');
assert.match(classifierSource, /ensureFreshScout/);
assert.match(classifierSource, /code-read-only-scout\.mjs/);
assert.match(classifierSource, /INVESTIGATION_DIR: investigationDir/);

const sample = 'Run 35012345678 failed: scripts/ci/test-auto-repair-architecture.mjs:10:3 no-unused-vars';
const normalized = normalizeFailure(sample);
assert(!normalized.includes('35012345678'));
assert(!normalized.includes('abcdefabcdefabcdefabcdefabcdefabcdefabcd'));
assert.equal(fingerprintFailure(sample), fingerprintFailure(sample));
const plan = planRepair(sample);
assert.equal(plan.selected?.id, 'eslint-unused');
assert.equal(confidenceGate({ selected: plan.selected, features: plan.features }).allowed, true);
assert.equal(plan.selected?.file, 'scripts/ci/test-auto-repair-architecture.mjs');
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
assert.equal(repairPolicy.maxAttemptsPerFingerprint, 1_000_000);
assert.equal(MEMORY_VERSION, 10);
assert.equal(typeof hydrateActionHistory, 'function');
assert.match(fs.readFileSync('scripts/ci/auto-repair-learning.mjs', 'utf8'), /rejectedStrategies/);
assert.match(fs.readFileSync('scripts/ci/auto-repair-learning.mjs', 'utf8'), /doNotRepeat/);
assert.match(fs.readFileSync('scripts/ci/auto-repair-learning.mjs', 'utf8'), /hydrateActionHistory/);
assert.match(fs.readFileSync('scripts/ci/auto-repair/reasoning.mjs', 'utf8'), /ONLY_FRESH_EXACT_SHA_SCOUT_EVIDENCE_IS_ACTIONABLE/);
assert.equal(INTRACTABLE_THRESHOLD, 3);
assert.equal(planRepair('webkit waitForGpuRender timeout').selected, null);
assert.equal(planRepair('typescript TS2322 type error').selected, null);
assert.equal(planRepair('certification FAST 66 DEEP 60').selected, null);
const externalPlan = planRepair('SessionModelError: CAPIError: 400 The requested model is not supported');
assert.equal(externalPlan.selected, null);
assert(externalPlan.features.includes('external-tooling'));

const sentinelPass = buildRegressionSentinel({ original: true, related: { ok: true }, protected: { pass: true } });
assert.equal(sentinelPass.ok, true);
const sentinelFail = buildRegressionSentinel({ original: true, related: false, protected: true });
assert.equal(sentinelFail.ok, false);
const proofInputWithSentinel = { targetSha: 'a'.repeat(40), changedPaths: ['src/example.ts'], diff: { files: ['src/example.ts'], lines: 2 }, regression: { ok: true }, regressionSentinel: sentinelPass };
const sentinelProof = validateRepairProof({ evidence: proofInputWithSentinel, rootCauseProof: { reproductionWasFailing: true, reproductionRecovered: true, regressionPassed: true, commandsPresent: true }, recurrenceProof: { required: true, firstPass: true, secondPass: true } });
assert.equal(sentinelProof.ok, true);
const failedSentinelProof = validateRepairProof({ evidence: { ...proofInputWithSentinel, regressionSentinel: sentinelFail }, rootCauseProof: { reproductionWasFailing: true, reproductionRecovered: true, regressionPassed: true, commandsPresent: true }, recurrenceProof: { required: true, firstPass: true, secondPass: true } });
assert(failedSentinelProof.failures.includes('regression-sentinel-incomplete'));

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
  version: 10,
  cases: [],
  playbooks: [],
  lessons: [{ id: 'good', fingerprint: learnedFingerprint, rootCause: 'eslint-specialist', rule: 'eslint-unused', confidence: 1 }],
  antiLessons: [{ id: 'bad', fingerprint: learnedFingerprint, rootCause: 'eslint-specialist', rule: 'eslint-unused', confidence: 1 }],
}, { fingerprint: learnedFingerprint });
assert.equal(ranked[0].anti, undefined);
assert.equal(ranked[0].rule, 'eslint-unused');
assert.equal(ranked.at(-1).anti, true);

const engineSource = fs.readFileSync('scripts/ci/auto-repair-engine.mjs', 'utf8');
assert.match(engineSource, /file: selected\?\.file \?\? plan\.reasoning\?\.location\?\.file/);
const fingerprintSource = fs.readFileSync('scripts/ci/auto-repair/fingerprint.mjs', 'utf8');
assert.match(fingerprintSource, /external-tooling/);
assert.match(fingerprintSource, /format/);
const taskAgentSource = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
assert.match(taskAgentSource, /maxCycles: MAX_REPAIR_CYCLES/);
assert.match(taskAgentSource, /maxPreparedFiles: MAX_PREPARED_FILES/);
const learningSource = fs.readFileSync('scripts/ci/auto-repair-learning.mjs', 'utf8');
assert(!learningSource.includes('git/refs/heads/flixo-intractable/'));
assert(!learningSource.includes('flixo-intractable/'));
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /MAJOR_MAX_REPAIR_CYCLES = 30/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /MAJOR_MAX_PREPARED_FILES = 60/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /MAJOR_MAX_INSPECTED_FILES = 240/);
assert.match(learningSource, /MEMORY_VERSION = 10/);
assert.match(learningSource, /Math\.max\(parsed\.version, MEMORY_VERSION\)/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /NORMAL_MAX_REPAIR_CYCLES = 12/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /MAX_STALLED_REPAIR_CYCLES = 3/);
assert.match(fs.readFileSync('scripts/ci/agent-execution-control.mjs', 'utf8'), /NORMAL_MAX_PREPARED_FILES = 12/);
const strategySource = fs.readFileSync('scripts/ci/repair-strategy.mjs', 'utf8');
assert.match(strategySource, /% strategies\.length/);
assert.match(strategySource, /teachingEscalation/);
assert.match(strategySource, /const isIntractable = teachingEscalation/);
assert.match(strategySource, /INTRACTABLE_THRESHOLD/);
assert.match(strategySource, /nextAttempt > threshold/);
const rollbackSource = fs.readFileSync('scripts/ci/auto-repair/historical-rollback.mjs', 'utf8');
assert.match(rollbackSource, /FLIXO-REPAIR-ROLLBACK-v1/);
assert.match(rollbackSource, /FLIXO-REPAIR-MARKER-v1/);
assert.match(rollbackSource, /git.*revert.*--no-commit/);
assert.match(rollbackSource, /isAncestor/);
assert.match(engineSource, /verified-historical-revert/);
assert.match(engineSource, /reverted-repair/);
assert.match(workflow, /verified-historical-revert/);
assert.match(workflow, /reverted-repair/);
assert.match(workflow, /FLIXO-REPAIR-MARKER-v1/);
assert.match(workflow, /FLIXO-REPAIR-ROLLBACK-v1/);
assert.match(workflow, /NON_GREEN_LEARNING_PUBLISH=DISABLED/);
assert.match(workflow, /NON_GREEN_LEARNING_PERSISTENCE=ARTIFACT_ONLY/);
assert.match(workflow, /blocked-external/);
assert(!workflow.includes('INTRACTABLE case reached: recursive repair is intentionally stopped.'));
assert.match(workflow, /FLIXO_TARGET_SHA/);
assert.match(workflow, /FLIXO_REVERTED_COMMIT/);
assert.match(learningSource, /reversions/);
assert.match(learningSource, /countsAsPlaybookAttempt/);
assert.match(learningSource, /revertedRules/);
assert.match(engineSource, /revertedRuleIds/);
assert.match(classifierSource, /deriveReusableKnowledge/);
assert.match(engineSource, /deriveReusableKnowledge/);
assert.match(engineSource, /reusableKnowledge\.generalizedRules/);
assert.match(taskAgentSource, /reusableKnowledge/);
assert.match(learningSource, /promotionRequiresDistinctFingerprints: 2/);
assert.match(learningSource, /successfulFingerprintSupport >= 2/);
assert.match(fs.readFileSync('scripts/ci/auto-repair/historical-rollback.mjs', 'utf8'), /revertedRules/);
console.log('AUTO_REPAIR_ARCHITECTURE_SELF_TEST=PASS');
