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

const master = registry.prompts.find((p) => p.promptId === 'RPR-CORE-MASTER-001');
const promptIntel = registry.prompts.find((p) => p.promptId === 'RPR-PROMPT-INTEL-001');
assert.ok(master);
assert.ok(promptIntel);
assert.notEqual(comparePrompts(master, promptIntel).sameFunctionalKey, true);

const candidates = selectPromptCandidates(registry, {
  failureClasses: ['PROMPT_DUPLICATE'],
  rootCauses: ['PROMPT_DUPLICATION'],
  domain: 'prompt-intelligence',
  agentRole: 'prompt-intelligence',
});
assert.equal(candidates[0]?.prompt.promptId, 'RPR-PROMPT-INTEL-001');

const duplicate = { ...promptIntel, promptId: 'RPR-TEST-DUP-001' };
const relations = detectPromptRelations([...registry.prompts, duplicate]);
assert.ok(relations.some((r) => r.type === 'DUPLICATE' && [r.promptA, r.promptB].includes('RPR-TEST-DUP-001')));

console.log(JSON.stringify({ status: 'PASS', prompts: registry.prompts.length, duplicateGuard: true, candidateSelection: true }, null, 2));