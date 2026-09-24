#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  loadPromptRegistry,
  loadErrorMemory,
  validatePromptRegistry,
  discoverPromptContext,
  selectRepairPrompt,
  createPromptHandoff,
  classifyPromptLearningOutcome,
  causalIdentity,
  buildCausalQuery,
  classifyCausalEvidence,
  retrieveCausalLearning,
} from './prompt-registry.mjs';

const registry = loadPromptRegistry();
const validation = validatePromptRegistry(registry);
assert.equal(validation.ok, true);
assert.equal(validation.status, 'VALID');
assert.equal(validation.promptCount, 1);
assert.equal(registry.prompts[0].promptId, 'RPR-UNIFIED-EXECUTION-001');
assert.equal(registry.prompts[0].status, 'ACTIVE');
assert.equal(registry.prompts[0].sourcePath, 'docs/agents/PROMPT-UNIFIED-EXECUTION.md');

const memory = loadErrorMemory();
const discovery = discoverPromptContext({
  registry,
  memory,
  failureFingerprint: 'SHA_RACE',
  rootCause: 'stale-evidence',
});
assert.equal(discovery.memoryIsAdvisoryOnly, true);
assert.equal(discovery.selection.status, 'REUSE');
assert.equal(discovery.selection.prompt.promptId, 'RPR-UNIFIED-EXECUTION-001');

for (const [fingerprint, rootCause] of [
  ['SHA_RACE', 'stale-evidence'],
  ['fingerprint-match', 'symptom-only-repair'],
  ['registry-asymmetry', 'duplicate-source-of-truth'],
  ['uncatalogued-fingerprint', 'uncatalogued-root'],
]) {
  const found = selectRepairPrompt({ registry, failureFingerprint: fingerprint, rootCause });
  assert.equal(found.status, 'REUSE');
  assert.equal(found.prompt.promptId, 'RPR-UNIFIED-EXECUTION-001');
}

const handoff = createPromptHandoff({
  registry,
  promptId: 'RPR-UNIFIED-EXECUTION-001',
  exactSha: 'a'.repeat(40),
  failureFingerprint: 'b'.repeat(64),
  rootCause: 'stale-evidence',
  evidence: ['current-run'],
});
assert.equal(handoff.promptId, 'RPR-UNIFIED-EXECUTION-001');
assert.equal(handoff.exactSha, 'a'.repeat(40));
assert.equal(handoff.status, 'CANDIDATE');
assert.ok(Array.isArray(handoff.allowedScope));
assert.ok(handoff.allowedScope.length >= 1);
assert.deepEqual(handoff.forbiddenScope.includes('direct-main-mutation'), true);
assert.equal(handoff.provenance.evidenceIsCurrentOnlyWhenBoundToExactSha, true);

for (const [input, expected] of [
  ['success', 'LESSON_CANDIDATE'],
  ['failure', 'ANTI_LESSON_CANDIDATE'],
  ['unrepaired', 'ANTI_LESSON_CANDIDATE'],
  ['reverted-repair', 'STRATEGY_REJECTION_SIGNAL'],
  ['proposed', 'NO_SUCCESS_CONFIDENCE'],
  ['blocked-external', 'BLOCKED_EXTERNAL'],
]) assert.equal(classifyPromptLearningOutcome(input), expected);

const duplicateRegistry = JSON.parse(JSON.stringify(registry));
const duplicate = { ...duplicateRegistry.prompts[0], promptId: 'RPR-TEST-DUP-001' };
duplicateRegistry.prompts.push(duplicate);
const duplicateCheck = validatePromptRegistry(duplicateRegistry);
assert.equal(duplicateCheck.ok, false);
assert.ok(duplicateCheck.errors.some((item) => item.startsWith('PROMPT_DUPLICATE_CAUSAL_KEY:')));

const invalidShaRegistry = JSON.parse(JSON.stringify(registry));
invalidShaRegistry.prompts[0].exactShaRequirements = ['current execution SHA'];
assert.equal(validatePromptRegistry(invalidShaRegistry).ok, false);

const missingSourceRegistry = JSON.parse(JSON.stringify(registry));
missingSourceRegistry.prompts[0].sourcePath = 'docs/agents/DOES-NOT-EXIST.md';
assert.equal(validatePromptRegistry(missingSourceRegistry).ok, false);

const causal = causalIdentity(registry.prompts[0]);
assert.equal(typeof causal, 'string');
assert.equal(causal.length, 64);

console.log('PROMPT_REGISTRY_TEST=PASS');


const currentSha = 'a'.repeat(40);
const staleSha = 'b'.repeat(40);

const adversarialArchetypes = [
  {
    name: 'superseded-cancellation',
    expectedClass: 'STALE',
    expectedAction: 'WAIT_FOR_FRESH_SHA',
    expectedRule: 'cancelled-run-classification',
    build: (i) => ({
      failureFingerprint: `heldout-stale-${i}`,
      cancellationReason: 'cancelled because a newer SHA superseded this run',
      shaState: 'MOVED',
      normalizedFailure: 'LIVE_HEAD_MOVED=1 LIVE_HEAD_MATCH=0',
    }),
  },
  {
    name: 'external-503',
    expectedClass: 'EXTERNAL',
    expectedAction: 'BLOCKED_EXTERNAL',
    expectedRule: 'preserve-external-evidence',
    build: (i) => ({
      failureFingerprint: `heldout-external-${i}`,
      providerSignature: 'HTTP 503 provider unavailable',
      firstFailingStep: 'Dispatch canonical RED wake to Chief GPT runtime',
    }),
  },
  {
    name: 'downstream-gate',
    expectedClass: 'DOWNSTREAM',
    expectedAction: 'TARGETED_PROBE',
    expectedRule: 'first-causal-before-downstream',
    build: (i) => ({
      failureFingerprint: `heldout-downstream-${i}`,
      workflow: 'Auto Repair Merge Gate',
      workflowRole: 'downstream gate',
      firstFailingStep: 'Require canonical workflow GREEN on exact SHA',
      normalizedFailure: 'upstream RED caused this gate to fail',
    }),
  },
  {
    name: 'proof-contract',
    expectedClass: 'CONTRACT',
    expectedAction: 'REPAIR',
    expectedRule: 'proof-chain-must-cover-mutation',
    build: (i) => ({
      failureFingerprint: `heldout-contract-${i}`,
      failureClass: 'proof-contract',
      rootCause: 'proof-coverage',
      normalizedFailure: 'SENSITIVE_CONTRACT_COMMIT_WITHOUT_PROOF',
    }),
  },
  {
    name: 'runtime',
    expectedClass: 'RUNTIME',
    expectedAction: 'REPAIR',
    expectedRule: 'classify-before-mutate',
    build: (i) => ({
      failureFingerprint: `heldout-runtime-${i}`,
      failureClass: 'browser-runtime',
      firstFailingStep: 'browser runtime message',
    }),
  },
  {
    name: 'internal-direct-failure',
    expectedClass: 'INTERNAL',
    expectedAction: 'REPAIR',
    expectedRule: 'root-only-mutation',
    build: (i) => ({
      failureFingerprint: `heldout-internal-${i}`,
      failureClass: 'build',
      rootCause: 'build',
      firstFailingStep: 'npm run test:build',
    }),
  },
  {
    name: 'unknown-needs-probe',
    expectedClass: 'UNKNOWN',
    expectedAction: 'TARGETED_PROBE',
    expectedRule: 'classify-before-mutate',
    build: (i) => ({
      failureFingerprint: `heldout-unknown-${i}`,
      normalizedFailure: 'insufficient causal evidence',
    }),
  },
  {
    name: 'stale-proof-mismatch',
    expectedClass: 'STALE',
    expectedAction: 'WAIT_FOR_FRESH_SHA',
    expectedRule: 'supersession-invalidates-proof',
    build: (i) => ({
      failureFingerprint: `heldout-proof-stale-${i}`,
      currentSha,
      evidenceSha: staleSha,
      normalizedFailure: 'historical proof attached to previous SHA',
    }),
  },
  {
    name: 'repeated-strategy',
    expectedClass: 'INTERNAL',
    expectedAction: 'ESCALATE',
    expectedRule: 'no-identical-recursion',
    build: (i) => ({
      failureFingerprint: `heldout-repeat-${i}`,
      rootCause: 'repair-convergence',
      repeatedStrategy: true,
      strategyId: 'prepared-source-change',
    }),
  },
  {
    name: 'unexpected-cancel-with-no-supersession',
    expectedClass: 'UNKNOWN',
    expectedAction: 'TARGETED_PROBE',
    expectedRule: 'never-stall-on-ambiguous-red',
    build: (i) => ({
      failureFingerprint: `heldout-ambiguous-cancel-${i}`,
      cancellationReason: 'cancelled without replacement SHA evidence',
    }),
  },
];

const heldOutMatrix = [];
for (let i = 1; i <= 10; i += 1) {
  for (const archetype of adversarialArchetypes) {
    heldOutMatrix.push({
      ...archetype,
      caseId: `${archetype.name}-${i}`,
      query: archetype.build(i),
    });
  }
}
assert.equal(heldOutMatrix.length, 100);

let classCorrect = 0;
let actionCorrect = 0;
let zeroStallValid = 0;
let causalRetrievalRecall = 0;

for (const fixture of heldOutMatrix) {
  const decision = classifyCausalEvidence(buildCausalQuery(fixture.query));
  if (decision.classification === fixture.expectedClass) classCorrect += 1;
  if (decision.nextAction === fixture.expectedAction) actionCorrect += 1;
  if ([
    'REPAIR',
    'TARGETED_PROBE',
    'ESCALATE',
    'BLOCKED_EXTERNAL',
    'WAIT_FOR_FRESH_SHA',
  ].includes(decision.nextAction)) zeroStallValid += 1;

  const retrieval = retrieveCausalLearning({
    memory,
    query: fixture.query,
    limit: 8,
  });
  const expectedFound = retrieval.ranked.some((entry) =>
    entry.item.rule === fixture.expectedRule ||
    entry.item.causalBehavior?.classification === fixture.expectedClass,
  );
  if (expectedFound) causalRetrievalRecall += 1;
}

const benchmark = Object.freeze({
  cases: heldOutMatrix.length,
  classificationAccuracy: classCorrect / heldOutMatrix.length,
  nextActionAccuracy: actionCorrect / heldOutMatrix.length,
  zeroStallCompliance: zeroStallValid / heldOutMatrix.length,
  causalRetrievalRecall: causalRetrievalRecall / heldOutMatrix.length,
});

assert.ok(benchmark.classificationAccuracy >= 0.95);
assert.ok(benchmark.nextActionAccuracy >= 0.95);
assert.equal(benchmark.zeroStallCompliance, 1);
assert.ok(benchmark.causalRetrievalRecall >= 0.90);

const staleRetrieval = retrieveCausalLearning({
  memory,
  query: {
    failureFingerprint: 'never-seen-fingerprint',
    cancellationReason: 'superseded by newer SHA',
    shaState: 'MOVED',
  },
  limit: 8,
});
assert.equal(staleRetrieval.decision.classification, 'STALE');
assert.equal(staleRetrieval.decision.mutationEligible, false);
assert.ok(staleRetrieval.lessons.concat(staleRetrieval.antiLessons).some((item) => item.causalBehavior?.classification === 'STALE'));

const externalRetrieval = retrieveCausalLearning({
  memory,
  query: {
    failureFingerprint: 'never-seen-external-fingerprint',
    providerSignature: 'HTTP 503 provider unavailable',
    firstFailingStep: 'Dispatch canonical RED wake to Chief GPT runtime',
  },
  limit: 8,
});
assert.equal(externalRetrieval.decision.classification, 'EXTERNAL');
assert.equal(externalRetrieval.decision.nextAction, 'BLOCKED_EXTERNAL');
assert.equal(externalRetrieval.decision.mutationEligible, false);
assert.ok(externalRetrieval.ranked.some((entry) => entry.item.rule === 'preserve-external-evidence'));

const downstreamRetrieval = retrieveCausalLearning({
  memory,
  query: {
    failureFingerprint: 'never-seen-downstream-fingerprint',
    workflow: 'Auto Repair Merge Gate',
    workflowRole: 'downstream gate',
    firstFailingStep: 'Require canonical workflow GREEN on exact SHA',
    normalizedFailure: 'upstream RED caused this gate to fail',
  },
  limit: 8,
});
assert.equal(downstreamRetrieval.decision.classification, 'DOWNSTREAM');
assert.equal(downstreamRetrieval.decision.mutationEligible, false);
assert.ok(downstreamRetrieval.ranked.some((entry) => entry.item.rule === 'first-causal-before-downstream'));

const freshVsStaleMemory = {
  version: 1,
  cases: [],
  lessons: [
    {
      id: 'stale-memory',
      fingerprint: 'other',
      rootCause: 'verification',
      rule: 'post-mutation-fresh-proof',
      claim: 'stale proof',
      targetSha: staleSha,
      status: 'PROVISIONAL_HISTORICAL_TEACHING',
    },
    {
      id: 'fresh-memory',
      fingerprint: 'other',
      rootCause: 'verification',
      rule: 'post-mutation-fresh-proof',
      claim: 'fresh proof',
      targetSha: currentSha,
      status: 'VERIFIED',
      canonicalGreen: true,
    },
  ],
  antiLessons: [],
};

const freshness = retrieveCausalLearning({
  memory: freshVsStaleMemory,
  historical: [],
  query: {
    failureFingerprint: 'never-seen-freshness-fingerprint',
    rootCause: 'verification',
    currentSha,
  },
  limit: 4,
});
assert.equal(freshness.lessons[0].id, 'fresh-memory');

console.log('CAUSAL_RCA_HELDOUT_BENCHMARK=' + JSON.stringify(benchmark));
