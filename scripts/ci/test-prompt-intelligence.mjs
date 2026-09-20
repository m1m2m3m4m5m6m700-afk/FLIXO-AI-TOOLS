#!/usr/bin/env node
import assert from 'node:assert/strict';
import { comparePrompts, detectPromptRelations, functionalKey, loadPromptRegistry, selectPromptCandidates, validatePromptRegistry } from './prompt-intelligence.mjs';
import fs from 'node:fs';

const registry = loadPromptRegistry();
const taskAgent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
assert.match(taskAgent, /selectedPromptId/);
assert.match(taskAgent, /exactSha/);
assert.match(taskAgent, /failureFingerprint/);
assert.match(taskAgent, /handoffSchema: 'PROMPT-HANDOFF-v1'/);
const result = validatePromptRegistry(registry);
assert.equal(result.valid, true);
assert.equal(new Set(registry.prompts.map((p) => p.promptId)).size, registry.prompts.length);
assert.equal(result.relations.some((r) => r.type === 'DUPLICATE'), false);
assert.ok(registry.prompts.every((prompt) => functionalKey(prompt).length === 24));

const master = registry.prompts.find((p) => p.promptId === 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');
const prior = registry.prompts.find((p) => p.promptId === 'RPR-EXISTING-SAFE-TASK-001');
assert.ok(master);
assert.ok(prior);
assert.notEqual(comparePrompts(master, prior).sameFunctionalKey, true);

const candidates = selectPromptCandidates(registry, {
  failureClasses: ['prompt-selection'],
  rootCauses: ['prompt-governance'],
  domain: 'error-intelligence-root-repair',
  agentRole: 'repairAgent',
});
assert.equal(candidates[0]?.prompt.promptId, 'RPR-PROMPT-02-ERROR-INTELLIGENCE-001');

const duplicate = { ...master, promptId: 'RPR-TEST-DUP-001' };
const relations = detectPromptRelations([...registry.prompts, duplicate]);
assert.ok(relations.some((r) => r.type === 'DUPLICATE' && [r.promptA, r.promptB].includes('RPR-TEST-DUP-001')));

console.log(JSON.stringify({ status: 'PASS', prompts: registry.prompts.length, duplicateGuard: true, candidateSelection: true }, null, 2));