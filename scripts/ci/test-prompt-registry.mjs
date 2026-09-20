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
assert.ok(validation.promptCount >= 10);

const memory = loadErrorMemory();
const discovery = discoverPromptContext({
  registry,
  memory,
  failureFingerprint: '83b077936ef0130cd635cdfa433ea9bebea9a4a4',
  rootCause: 'orchestration',
});
assert.equal(discovery.memoryIsAdvisoryOnly, true);
assert.equal(discovery.selection.status, 'REUSE');
assert.equal(discovery.selection.prompt.promptId, 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');

const cases = [
  ['83b077936ef0130cd635cdfa433ea9bebea9a4a4', 'orchestration', 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001'],
  ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'external-tooling', 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001'],
  ['cc208a65323355b8846d7aa6d7e85f742feb8909', 'lint', 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001'],
  ['11a69c066357a565d2cc26afd516d4b2d1eb6f7b', 'architecture', 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001'],
];
const canonical = selectRepairPrompt({
  registry,
  failureFingerprint: 'f'.repeat(64),
  rootCause: 'noncanonical-automation',
  failureClass: 'noncanonical-automation',
});
assert.equal(canonical.status, 'REUSE');
assert.equal(canonical.prompt.promptId, 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');
const liveness = selectRepairPrompt({
  registry,
  failureFingerprint: 'f'.repeat(64),
  rootCause: 'liveness-contract',
  failureClass: 'liveness-contract',
});
assert.equal(liveness.status, 'REUSE');
assert.equal(liveness.prompt.promptId, 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');
const drift = selectRepairPrompt({
  registry,
  failureFingerprint: 'f'.repeat(64),
  rootCause: 'contract-drift',
  failureClass: 'contract-test-mismatch',
});
assert.equal(drift.status, 'REUSE');
assert.equal(drift.prompt.promptId, 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');

for (const [fingerprint, rootCause, expected] of cases) {
  const found = selectRepairPrompt({ registry, failureFingerprint: fingerprint, rootCause });
  assert.equal(found.status, 'REUSE');
  assert.equal(found.prompt.promptId, expected);
}

const unknown = selectRepairPrompt({ registry, failureFingerprint: 'f'.repeat(64), rootCause: 'unknown' });
assert.equal(unknown.status, 'PROMPT_REVIEW_REQUIRED');

const handoff = createPromptHandoff({
  registry,
  promptId: 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001',
  exactSha: 'a'.repeat(40),
  failureFingerprint: '83b077936ef0130cd635cdfa433ea9bebea9a4a4',
  rootCause: 'orchestration',
  evidence: ['current-run'],
});
assert.equal(handoff.promptId, 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');
assert.equal(handoff.exactSha, 'a'.repeat(40));
assert.equal(handoff.status, 'CANDIDATE');
assert.ok(handoff.allowedScope.length > 0);
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
const one = duplicateRegistry.prompts.find((item) => item.promptId === 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');
const two = duplicateRegistry.prompts.find((item) => item.promptId === 'RPR-EXISTING-SAFE-TASK-001');
two.status = 'CANDIDATE';
two.failureClasses = [...one.failureClasses];
two.rootCauses = [...one.rootCauses];
two.scope = JSON.parse(JSON.stringify(one.scope));
two.repairStrategy = [...one.repairStrategy];
two.verificationPlan = [...one.verificationPlan];
two.causalKey = causalIdentity(two);
const duplicateCheck = validatePromptRegistry(duplicateRegistry);
assert.equal(duplicateCheck.ok, false);
assert.ok(duplicateCheck.errors.some((item) => item.startsWith('PROMPT_DUPLICATE_CAUSAL_KEY:')));

const invalidShaRegistry = JSON.parse(JSON.stringify(registry));
invalidShaRegistry.prompts[0].exactShaRequirements.bindAtExecution = false;
assert.equal(validatePromptRegistry(invalidShaRegistry).ok, false);

console.log('PROMPT_REGISTRY_TEST=PASS');
