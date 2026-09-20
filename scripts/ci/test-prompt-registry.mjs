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
