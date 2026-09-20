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
} from './prompt-registry.mjs';

const registry = loadPromptRegistry();
const validation = validatePromptRegistry(registry);
assert.equal(validation.ok, true);
assert.equal(validation.status, 'VALID');
assert.equal(validation.promptCount, 3);

const memory = loadErrorMemory();
const discovery = discoverPromptContext({
  registry,
  memory,
  failureFingerprint: 'SHA_RACE',
  rootCause: 'stale-evidence',
});
assert.equal(discovery.memoryIsAdvisoryOnly, true);
assert.equal(discovery.selection.status, 'REUSE');
assert.equal(discovery.selection.prompt.promptId, 'RPR-MASTER-EXECUTION-001');

const currentCases = [
  ['SHA_RACE', 'stale-evidence', 'RPR-MASTER-EXECUTION-001'],
  ['fingerprint-match', 'symptom-only-repair', 'RPR-ERROR-REPAIR-001'],
  ['registry-asymmetry', 'duplicate-source-of-truth', 'RPR-FLIXO-PRODUCT-001'],
];
for (const [fingerprint, rootCause, expected] of currentCases) {
  const found = selectRepairPrompt({ registry, failureFingerprint: fingerprint, rootCause });
  assert.equal(found.status, 'REUSE');
  assert.equal(found.prompt.promptId, expected);
}

const unknown = selectRepairPrompt({ registry, failureFingerprint: 'unknown-fingerprint', rootCause: 'unknown' });
assert.equal(unknown.status, 'PROMPT_REVIEW_REQUIRED');

const handoff = createPromptHandoff({
  registry,
  promptId: 'RPR-MASTER-EXECUTION-001',
  exactSha: 'a'.repeat(40),
  failureFingerprint: 'b'.repeat(64),
  rootCause: 'stale-evidence',
  evidence: ['current-run'],
});
assert.equal(handoff.promptId, 'RPR-MASTER-EXECUTION-001');
assert.equal(handoff.exactSha, 'a'.repeat(40));
assert.equal(handoff.status, 'CANDIDATE');
assert.ok(Array.isArray(handoff.allowedScope));
assert.equal(handoff.allowedScope.length, 1);
assert.deepEqual(handoff.forbiddenScope, []);
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
const one = duplicateRegistry.prompts.find((item) => item.promptId === 'RPR-MASTER-EXECUTION-001');
const two = duplicateRegistry.prompts.find((item) => item.promptId === 'RPR-ERROR-REPAIR-001');
two.failureClasses = [...one.failureClasses];
two.rootCauses = [...one.rootCauses];
two.scope = one.scope;
two.repairStrategy = [...one.repairStrategy];
two.verificationPlan = [...one.verificationPlan];
two.causalKey = causalIdentity(two);
const duplicateCheck = validatePromptRegistry(duplicateRegistry);
assert.equal(duplicateCheck.ok, false);
assert.ok(duplicateCheck.errors.some((item) => item.startsWith('PROMPT_DUPLICATE_CAUSAL_KEY:')));

const invalidShaRegistry = JSON.parse(JSON.stringify(registry));
invalidShaRegistry.prompts[0].exactShaRequirements = ['current execution SHA'];
assert.equal(validatePromptRegistry(invalidShaRegistry).ok, false);

const missingSourceRegistry = JSON.parse(JSON.stringify(registry));
delete missingSourceRegistry.prompts[0].sourcePath;
assert.equal(validatePromptRegistry(missingSourceRegistry).ok, false);

console.log('PROMPT_REGISTRY_TEST=PASS');
