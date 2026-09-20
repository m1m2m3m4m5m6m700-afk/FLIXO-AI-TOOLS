#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  comparePrompts,
  detectPromptRelations,
  functionalKey,
  loadPromptRegistry,
  selectPromptCandidates,
  validatePromptRegistry,
} from './prompt-intelligence.mjs';
import fs from 'node:fs';

const registry = loadPromptRegistry();
const taskAgent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
assert.match(taskAgent, /selectedPromptId/);
assert.match(taskAgent, /exactSha/);
assert.match(taskAgent, /failureFingerprint/);
assert.match(taskAgent, /handoffSchema: 'PROMPT-HANDOFF-v1'/);

const result = validatePromptRegistry(registry);
assert.equal(result.valid, true);
assert.equal(registry.prompts.length, 1);
assert.equal(registry.prompts[0].promptId, 'RPR-UNIFIED-EXECUTION-001');
assert.ok(registry.prompts.every((prompt) => functionalKey(prompt).length === 24));
assert.equal(result.relations.some((r) => r.type === 'DUPLICATE'), false);

const unified = registry.prompts[0];
assert.equal(unified.agentRole, 'executive-repair-development-controller');
assert.ok(unified.failureClasses.includes('ALL_REPAIRABLE'));
assert.ok(unified.rootCauses.includes('ANY_CONFIRMED_RCA'));

const candidates = selectPromptCandidates(registry, {
  failureClasses: ['SOURCE', 'CI_ORCHESTRATION'],
  rootCauses: ['stale-contract', 'race-condition'],
  domain: 'unified-repository-execution',
  agentRole: 'executive-repair-development-controller',
});
assert.equal(candidates[0]?.prompt.promptId, 'RPR-UNIFIED-EXECUTION-001');

const duplicate = { ...unified, promptId: 'RPR-TEST-DUP-001' };
const relations = detectPromptRelations([...registry.prompts, duplicate]);
assert.ok(relations.some((r) => r.type === 'DUPLICATE' && [r.promptA, r.promptB].includes('RPR-TEST-DUP-001')));
assert.equal(comparePrompts(unified, duplicate).sameFunctionalKey, true);

console.log(JSON.stringify({
  status: 'PASS',
  prompts: registry.prompts.length,
  unifiedPrompt: true,
  duplicateGuard: true,
  candidateSelection: true,
}, null, 2));
