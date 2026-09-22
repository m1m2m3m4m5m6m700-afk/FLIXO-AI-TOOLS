import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fingerprintFailure, loadMemory, recordOutcome, scorePlaybook, findSimilarCases, rankLessons, normalizeLearningOutcome, deriveReusableKnowledge, hydrateActionHistory, normalizeMemoryCounters, mergeMemoryHistory, MEMORY_RELATION_TYPES, normalizeRelations, normalizeDiagnosticRecord, MEMORY_VERSION, INTRACTABLE_THRESHOLD } from './auto-repair-learning.mjs';

const sample = 'Run 35012345678 failed on webkit at abcdefabcdefabcdefabcdefabcdefabcdefabcd: Seed waitForGpuRender';
const fingerprint = fingerprintFailure(sample);
assert(!fingerprint.includes('35012345678'));
assert(!fingerprint.includes('abcdefabcdefabcdefabcdefabcdefabcdefabcd'));

const learningEnvironment = {
  GH_TOKEN: process.env.GH_TOKEN,
  GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
  FLIXO_RUN_ID: process.env.FLIXO_RUN_ID,
};
delete process.env.GH_TOKEN;
delete process.env.GITHUB_REPOSITORY;
delete process.env.FLIXO_RUN_ID;

const memory = loadMemory();
assert(memory.version >= MEMORY_VERSION);
assert.equal(INTRACTABLE_THRESHOLD, 10);
const previousGreen = process.env.FLIXO_CANONICAL_GREEN;
const previousGreenSha = process.env.FLIXO_CANONICAL_GREEN_SHA;
const previousTargetSha = process.env.FLIXO_TARGET_SHA;
delete process.env.FLIXO_CANONICAL_GREEN;
delete process.env.FLIXO_CANONICAL_GREEN_SHA;
process.env.FLIXO_TARGET_SHA = 'a'.repeat(40);
assert.equal(normalizeLearningOutcome('success', 'verified-repair'), 'proposed');
assert.equal(normalizeLearningOutcome('repair-applied', 'exact-sha-proof'), 'proposed');
process.env.FLIXO_CANONICAL_GREEN = 'true';
process.env.FLIXO_CANONICAL_GREEN_SHA = 'a'.repeat(40);
assert.equal(normalizeLearningOutcome('success', 'verified-repair'), 'success');
if (previousGreen === undefined) delete process.env.FLIXO_CANONICAL_GREEN; else process.env.FLIXO_CANONICAL_GREEN = previousGreen;
if (previousGreenSha === undefined) delete process.env.FLIXO_CANONICAL_GREEN_SHA; else process.env.FLIXO_CANONICAL_GREEN_SHA = previousGreenSha;
if (previousTargetSha === undefined) delete process.env.FLIXO_TARGET_SHA; else process.env.FLIXO_TARGET_SHA = previousTargetSha;

const diagnostic = normalizeDiagnosticRecord({
  rootCause: 'lint',
  violatedInvariant: 'UNEXPECTED_UNUSED_SYMBOL',
  causalSource: 'src/example.ts',
  confidence: 0.97,
  falsificationCheck: 'lint reproduces on exact SHA',
  propagationPath: ['lint', 'task-agent'],
  location: { file: 'src/example.ts', line: 18, column: 4 },
}, { affectedPaths: ['src/example.ts'] });
assert.equal(diagnostic.rootCause, 'lint');
assert.equal(diagnostic.location.file, 'src/example.ts');
assert.deepEqual(diagnostic.affectedPaths, ['src/example.ts']);

assert(Array.isArray(memory.actionHistory));

const normalizedCorruptMemory = normalizeMemoryCounters({
  version: 10,
  cases: [
    {
      fingerprint: '__stale_success__',
      attempts: 1,
      successes: 1,
      failures: 1,
      outcomes: [
        { outcome: 'repair', verification: 'success' },
        { outcome: 'stale', verification: 'invalidated' },
      ],
    },
    {
      fingerprint: '__external_current__',
      attempts: 0,
      successes: 0,
      failures: 6,
      outcomes: [
        { outcome: 'current', verification: 'failure', provenance: { source: 'GitHub Advanced Security' } },
      ],
    },
  ],
});
assert.equal(normalizedCorruptMemory.cases[0].attempts, 1);
assert.equal(normalizedCorruptMemory.cases[0].successes, 1);
assert.equal(normalizedCorruptMemory.cases[0].failures, 0);
assert.equal(normalizedCorruptMemory.cases[1].attempts, 0);
assert.equal(normalizedCorruptMemory.cases[1].successes, 0);
assert.equal(normalizedCorruptMemory.cases[1].failures, 0);

const mergedMemory = mergeMemoryHistory(
  {
    version: 9,
    cases: [{
      fingerprint: '__carry_case__',
      attempts: 1,
      successes: 1,
      failures: 0,
      outcomes: [{ outcome: 'repair', verification: 'success', provenance: { runId: '1', failedSha: 'a'.repeat(40) } }],
    }],
    playbooks: [],
    lessons: [],
    antiLessons: [],
  },
  {
    version: 10,
    cases: [{
      fingerprint: '__carry_case__',
      attempts: 1,
      successes: 1,
      failures: 2,
      outcomes: [{ outcome: 'stale', verification: 'invalidated', provenance: { runId: '2', failedSha: 'b'.repeat(40) } }],
    }, {
      fingerprint: '__new_carried_case__',
      attempts: 1,
      successes: 0,
      failures: 1,
      outcomes: [{ outcome: 'failure', verification: 'failed', provenance: { runId: '3', failedSha: 'c'.repeat(40) } }],
    }],
    playbooks: [],
    lessons: [],
    antiLessons: [],
  },
);
const carried = mergedMemory.cases.find((item) => item.fingerprint === '__carry_case__');
assert(carried);
assert.equal(carried.attempts, 1);
assert.equal(carried.successes, 1);
assert.equal(carried.failures, 0);
assert(mergedMemory.cases.some((item) => item.fingerprint === '__new_carried_case__'));

const mergedActionHistory = mergeMemoryHistory(
  { version: 10, cases: [], playbooks: [], lessons: [], antiLessons: [], actionHistory: [{ fingerprint: '__action_a__', occurrences: 1, evidence: [{ runId: '1' }] }] },
  { version: 10, cases: [], playbooks: [], lessons: [], antiLessons: [], actionHistory: [{ fingerprint: '__action_a__', occurrences: 2, evidence: [{ runId: '2' }] }, { fingerprint: '__action_b__', occurrences: 1, evidence: [{ runId: '3' }] }] },
);
assert.equal(mergedActionHistory.actionHistory.length, 2);
assert.equal(mergedActionHistory.actionHistory.find((item) => item.fingerprint === '__action_a__').occurrences, 2);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-memory-'));
const trustedMemoryPath = path.join(tempRoot, 'trusted.json');
const derivedMemoryPath = path.join(tempRoot, 'derived.json');
fs.writeFileSync(trustedMemoryPath, JSON.stringify({ version: 10, cases: [{ fingerprint: '__trusted_case__', attempts: 0, successes: 0, failures: 0, outcomes: [] }], playbooks: [], lessons: [], antiLessons: [] }));
fs.writeFileSync(derivedMemoryPath, JSON.stringify({ version: 10, cases: [{ fingerprint: '__derived_case__', attempts: 1, successes: 0, failures: 1, outcomes: [{ outcome: 'failure', verification: 'failed' }] }], playbooks: [], lessons: [], antiLessons: [] }));
const previousTrustedMemory = process.env.FLIXO_TRUSTED_REPAIR_MEMORY;
const previousTaskId = process.env.FLIXO_TASK_ID;
const previousRepairChainId = process.env.FLIXO_REPAIR_CHAIN_ID;
const previousRunId = process.env.FLIXO_RUN_ID;
process.env.FLIXO_TASK_ID = 'TEST-TASK-LEDGER-001';
process.env.FLIXO_REPAIR_CHAIN_ID = 'TEST-CHAIN-001';
process.env.FLIXO_RUN_ID = '54321';
const previousDerivedMemory = process.env.FLIXO_DERIVED_REPAIR_MEMORY;
process.env.FLIXO_TRUSTED_REPAIR_MEMORY = trustedMemoryPath;
process.env.FLIXO_DERIVED_REPAIR_MEMORY = derivedMemoryPath;
const loadedMergedMemory = loadMemory();
if (previousTrustedMemory === undefined) delete process.env.FLIXO_TRUSTED_REPAIR_MEMORY; else process.env.FLIXO_TRUSTED_REPAIR_MEMORY = previousTrustedMemory;
if (previousDerivedMemory === undefined) delete process.env.FLIXO_DERIVED_REPAIR_MEMORY; else process.env.FLIXO_DERIVED_REPAIR_MEMORY = previousDerivedMemory;
fs.rmSync(tempRoot, { recursive: true, force: true });
assert(loadedMergedMemory.cases.some((item) => item.fingerprint === '__trusted_case__'));
assert(loadedMergedMemory.cases.some((item) => item.fingerprint === '__derived_case__'));
const before = memory.cases.length;
const hadSelfTestCase = memory.cases.some((item) => item.fingerprint === '__self_test__');
recordOutcome(memory, {
  fingerprint: '__self_test__',
  normalizedFailure: 'lint no-unused-vars src/example.ts',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'success',
  verification: 'passed',
});
assert.equal(memory.cases.length, before + (hadSelfTestCase ? 0 : 1));
assert.equal(scorePlaybook(memory, 'lint', 'eslint-unused'), 1);
recordOutcome(memory, {
  fingerprint: '__relation_case__',
  normalizedFailure: 'build contract relation test',
  features: ['contract'],
  rootCause: 'contract',
  rule: 'existing-contract-fix',
  outcome: 'success',
  verification: 'exact-sha-proof',
  provenance: { runId: '12345', targetSha: 'a'.repeat(40) },
  relationships: [
    { type: 'caused-by', target: 'contract:missing-input', targetSha: 'b'.repeat(40), evidenceRef: 'run:12345' },
    { type: 'verified-by', target: 'run:12345', sourceSha: 'a'.repeat(40) },
  ],
});
const repairTask = memory.repairTasks.find((item) => item.taskId === 'TEST-TASK-LEDGER-001');
assert(repairTask);
assert.equal(repairTask.repairChainId, 'TEST-CHAIN-001');
assert.equal(repairTask.failureRunId, '54321');
const relationCase = memory.cases.find((item) => item.fingerprint === '__relation_case__');
assert.equal(relationCase?.relations?.length, 2);
assert.deepEqual(relationCase.relations.map((item) => item.type).sort(), ['caused-by', 'verified-by']);
assert.equal(MEMORY_RELATION_TYPES.length, 7);
assert.equal(normalizeRelations([
  { type: 'not-real', target: 'x', sourceFingerprint: '__relation_case__' },
  { type: 'caused-by', target: '', sourceFingerprint: '__relation_case__' },
], '__relation_case__').length, 0);

recordOutcome(memory, {
  fingerprint: '__general_case_a__',
  normalizedFailure: 'eslint no-unused-vars src/a.ts',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'success',
  verification: 'exact-sha-proof',
});
recordOutcome(memory, {
  fingerprint: '__general_case_b__',
  normalizedFailure: 'eslint no-unused-vars src/b.ts',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'success',
  verification: 'exact-sha-proof',
});
const reusable = deriveReusableKnowledge(memory, { rootCause: 'lint', features: ['lint'], fingerprint: '__new_lint_case__' });
assert.equal(reusable.schemaVersion, 3);
assert(reusable.generalizedRules.some((item) => item.rule === 'eslint-unused' && item.successfulFingerprintSupport >= 2));
const historicalAdvisory = deriveReusableKnowledge({ version: 10, cases: [], playbooks: [], lessons: [], antiLessons: [] }, { rootCause: 'lint', features: ['lint'], fingerprint: '__historical_lint_case__' });
assert(historicalAdvisory.historicalAdvisories.some((item) => item.rule === 'exact-source-location' && item.status === 'historical-advisory'));
assert(historicalAdvisory.historicalAdvisories.every((item) => item.activation === 'fresh-proof-required'));
const mirroredMemory = {
  ...memory,
  playbooks: [{
    rootCause: 'lint',
    rule: 'eslint-unused',
    attempts: 2,
    successes: 2,
    failures: 0,
    fingerprints: ['__general_case_a__', '__general_case_b__'],
    successfulFingerprints: ['__general_case_a__', '__general_case_b__'],
    failedFingerprints: [],
  }],
};
const mirroredKnowledge = deriveReusableKnowledge(mirroredMemory, { rootCause: 'lint', features: ['lint'] });
const mirroredRule = mirroredKnowledge.generalizedRules.find((item) => item.rule === 'eslint-unused');
assert(mirroredRule);
assert.equal(mirroredRule.attempts, reusable.generalizedRules.find((item) => item.rule === 'eslint-unused').attempts);
assert.equal(reusable.rejectedRules.some((item) => item.rule === 'eslint-unused'), false);
assert(memory.lessons.some((item) => item.fingerprint === '__self_test__'));
assert.equal(memory.actionHistory.find((item) => item.fingerprint === '__self_test__')?.attempts, 1);
if (previousTaskId === undefined) delete process.env.FLIXO_TASK_ID; else process.env.FLIXO_TASK_ID = previousTaskId;
if (previousRepairChainId === undefined) delete process.env.FLIXO_REPAIR_CHAIN_ID; else process.env.FLIXO_REPAIR_CHAIN_ID = previousRepairChainId;
if (previousRunId === undefined) delete process.env.FLIXO_RUN_ID; else process.env.FLIXO_RUN_ID = previousRunId;

const hydrated = hydrateActionHistory({
  version: 10,
  cases: [{
    fingerprint: '__hydrated_repeat__',
    rootCause: 'external-tooling',
    attempts: 1,
    successes: 0,
    failures: 1,
    outcomes: [
      { outcome: 'unrepaired', verification: 'engine-error', provenance: { runId: 'r1', failedSha: 'a'.repeat(40) }, at: '2026-09-20T00:00:00Z' },
      { outcome: 'unrepaired', verification: 'engine-error', provenance: { runId: 'r2', failedSha: 'b'.repeat(40) }, at: '2026-09-20T00:01:00Z' },
      { outcome: 'unrepaired', verification: 'engine-error', provenance: { runId: 'r3', failedSha: 'c'.repeat(40) }, at: '2026-09-20T00:02:00Z' },
    ],
  }],
  playbooks: [], lessons: [], antiLessons: [], actionHistory: [],
});
const hydratedRepeat = hydrated.actionHistory.find((item) => item.fingerprint === '__hydrated_repeat__');
assert.equal(hydratedRepeat?.attempts, 3);
assert.equal(hydratedRepeat?.failures, 3);

recordOutcome(memory, {
  fingerprint: '__proposed_test__',
  normalizedFailure: 'repair applied without canonical green',
  features: ['repair'],
  rootCause: 'repair',
  rule: 'unverified-repair',
  outcome: 'proposed',
  verification: 'verified-repair',
  provenance: { runId: 'proposed-run', targetSha: 'a'.repeat(40) },
});
const unverifiedProposalCase = memory.cases.find((item) => item.fingerprint === '__proposed_test__');
assert.equal(unverifiedProposalCase?.attempts, 1);
assert.equal(unverifiedProposalCase?.successes, 0);
assert.equal(unverifiedProposalCase?.failures, 1);
assert.equal(proposedCase?.attempts, 1);
assert.equal(proposedCase?.successes, 0);
assert.equal(proposedCase?.failures, 1);
assert(memory.antiLessons.some((item) => item.fingerprint === '__proposed_test__'));

recordOutcome(memory, {
  fingerprint: '__negative_test__',
  normalizedFailure: 'lint no-unused-vars src/example.ts',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'failure',
  verification: 'failed',
});
assert(memory.antiLessons.some((item) => item.fingerprint === '__negative_test__'));
const diagnosticFingerprint = 'd'.repeat(64);
recordOutcome(memory, {
  fingerprint: diagnosticFingerprint,
  normalizedFailure: 'lint failure at src/example.ts:18',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'failure',
  verification: 'targeted-failure',
  diagnosis: diagnostic,
  affectedPaths: ['src/example.ts'],
  provenance: { runId: 'diagnostic-run', failedSha: 'c'.repeat(40), targetSha: 'c'.repeat(40) },
});
const diagnosticCase = memory.cases.find((item) => item.fingerprint === diagnosticFingerprint);
assert.deepEqual(diagnosticCase?.latestDiagnosis?.affectedPaths, ['src/example.ts']);
assert.equal(diagnosticCase?.outcomes.at(-1)?.diagnosis?.violatedInvariant, 'UNEXPECTED_UNUSED_SYMBOL');
assert.deepEqual(
  memory.actionHistory.find((item) => item.fingerprint === diagnosticFingerprint)?.evidence.at(-1)?.affectedPaths,
  ['src/example.ts'],
);

const fiveXFingerprint = '5'.repeat(64);
recordOutcome(memory, {
  fingerprint: fiveXFingerprint,
  normalizedFailure: 'five x cycle test',
  features: ['five-x'],
  rootCause: 'five-x-cycle',
  rule: 'five-x-strategy',
  outcome: 'success',
  verification: 'exact-sha-proof',
  provenance: {
    targetSha: 'a'.repeat(40),
    currentSha: 'a'.repeat(40),
    failedSha: 'a'.repeat(40),
    strategyId: 'five-x-strategy',
    runId: 'five-x-run',
  },
});
const fiveXCase = memory.cases.find((item) => item.fingerprint === fiveXFingerprint);
assert(fiveXCase?.lastFiveXCycle);
assert.equal(fiveXCase.lastFiveXCycle.protocol, 'FLIXO-FIVE-X-REPAIR-CYCLE-v1');
assert.equal(fiveXCase.lastFiveXCycle.targetSha, 'a'.repeat(40));
assert.equal(fiveXCase.lastFiveXCycle.state, 'VERIFICATION_PENDING_CANONICAL_GREEN');
assert.equal(memory.actionHistory.find((item) => item.fingerprint === fiveXFingerprint)?.lastFiveXCycle?.state, 'VERIFICATION_PENDING_CANONICAL_GREEN');

const afterFailureKnowledge = deriveReusableKnowledge(memory, { rootCause: 'lint', features: ['lint'] });
assert.equal(afterFailureKnowledge.generalizedRules.some((item) => item.rule === 'eslint-unused'), false);
assert.equal(afterFailureKnowledge.rejectedRules.some((item) => item.rule === 'eslint-unused' && item.reason === 'low-success-rate'), false);

const proposedBefore = memory.cases.find((item) => item.fingerprint === '__proposal_test__')?.attempts ?? 0;
recordOutcome(memory, {
  fingerprint: '__proposal_test__',
  normalizedFailure: 'webkit DEEP_SEMANTIC_MISSING=webkit:DEEP:webkit:ja',
  features: ['playwright', 'webkit', 'certification'],
  rootCause: 'webkit-render',
  outcome: 'proposed',
  verification: 'root-cause-evidence-insufficient',
});
const rejectedProposalCase = memory.cases.find((item) => item.fingerprint === '__proposal_test__');
assert.equal(rejectedProposalCase?.attempts ?? 0, proposedBefore);
assert(!memory.antiLessons.some((item) => item.fingerprint === '__proposal_test__'));

const revertBefore = memory.cases.find((item) => item.fingerprint === '__revert_test__')?.reversions ?? 0;
const attemptBeforeRevert = memory.cases.find((item) => item.fingerprint === '__revert_test__')?.attempts ?? 0;
recordOutcome(memory, {
  fingerprint: '__revert_test__',
  normalizedFailure: 'lint repair later regressed',
  features: ['lint'],
  rootCause: 'lint',
  rule: 'eslint-unused',
  outcome: 'reverted-repair',
  verification: 'historical-revert-proof',
  provenance: { targetSha: 'a'.repeat(40), revertedCommit: 'b'.repeat(40) },
});
const revertedCase = memory.cases.find((item) => item.fingerprint === '__revert_test__');
assert.equal(revertedCase?.attempts ?? 0, attemptBeforeRevert);
assert.equal(revertedCase?.reversions ?? 0, revertBefore + 1);
assert.deepEqual(revertedCase?.revertedRules ?? [], ['eslint-unused']);
assert.deepEqual(revertedCase?.revertedCommits ?? [], ['b'.repeat(40)]);
assert.equal(revertedCase?.failures ?? 0, 0);
assert.equal(scorePlaybook(memory, 'lint', 'eslint-unused'), 0.75);

for (const [key, value] of Object.entries(learningEnvironment)) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

const fallbackOutcome = process.env.FLIXO_LEARNING_OUTCOME;
const fallbackVerification = process.env.FLIXO_VERIFICATION;
process.env.FLIXO_LEARNING_OUTCOME = 'unrepaired';
process.env.FLIXO_VERIFICATION = 'proposal-only';
assert.equal(
  process.env.FLIXO_LEARNING_OUTCOME === 'unrepaired' && process.env.FLIXO_VERIFICATION === 'proposal-only',
  true
);
if (fallbackOutcome === undefined) delete process.env.FLIXO_LEARNING_OUTCOME; else process.env.FLIXO_LEARNING_OUTCOME = fallbackOutcome;
if (fallbackVerification === undefined) delete process.env.FLIXO_VERIFICATION; else process.env.FLIXO_VERIFICATION = fallbackVerification;


const similar = findSimilarCases(memory, {
  fingerprint: '__different_test__',
  normalized: 'lint no-unused-vars src/example.ts',
  features: ['lint'],
});
assert(similar.some((item) => item.case.fingerprint === '__self_test__'));
assert(similar[0].score >= 0.45);

const ranked = rankLessons(memory, { fingerprint: '__self_test__' });
assert(ranked.some((item) => item.fingerprint === '__self_test__' && !item.anti));
assert.equal(normalizeLearningOutcome('unrepaired', 'proposal-only'), 'proposed');
assert.equal(normalizeLearningOutcome('unrepaired', 'diagnostic-only'), 'proposed');
assert.equal(normalizeLearningOutcome('unrepaired', 'exception'), 'unrepaired');

const cliDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-learning-cli-'));
const cliMemory = path.join(cliDir, 'memory.json');
const cliIntractable = path.join(cliDir, 'intractable.json');
const cliLog = path.join(cliDir, 'failure.log');
fs.writeFileSync(cliLog, 'Certification execution graph incomplete DEEP_SEMANTIC_MISSING=webkit:DEEP:webkit:ja\n');
const cliRun = spawnSync(process.execPath, ['scripts/ci/auto-repair-learning.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FLIXO_REPAIR_MEMORY: cliMemory,
    FLIXO_INTRACTABLE_ERRORS: cliIntractable,
    FLIXO_FAILURE_LOG: cliLog,
    FLIXO_LEARNING_OUTCOME: 'unrepaired',
    FLIXO_VERIFICATION: 'diagnostic-only',
    FLIXO_ROOT_CAUSE: 'webkit-render',
    FLIXO_REPAIR_RULE: '',
    FLIXO_FAILED_SHA: 'a'.repeat(40),
    FLIXO_RUN_ID: 'test-run',
  },
  encoding: 'utf8',
});
assert.equal(cliRun.status, 0);
const cliMemoryData = JSON.parse(fs.readFileSync(cliMemory, 'utf8'));
const cliFingerprint = fingerprintFailure(fs.readFileSync(cliLog, 'utf8'));
const cliCase = cliMemoryData.cases.find((item) => item.fingerprint === cliFingerprint && item.rootCause === 'webkit-render');
assert(cliCase);
assert.equal(cliCase.attempts, 0);
assert.equal(cliCase.failures, 0);
assert(cliCase.outcomes.some((item) => item.outcome === 'proposed'));

console.log('AUTO_REPAIR_LEARNING_SELF_TEST=PASS');
