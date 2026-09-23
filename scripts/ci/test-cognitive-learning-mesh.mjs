#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sync=fs.readFileSync('scripts/ci/sync-cognitive-learning-mesh.mjs','utf8');
const gateway=fs.readFileSync('src/lib/contracts/agent-gateway.ts','utf8');
const api=fs.readFileSync('api/flixo-agent.ts','utf8');
const prompt=fs.readFileSync('src/lib/agent/human-conversation.ts','utf8');
const clone=JSON.parse(fs.readFileSync('docs/agents/EXECUTION-AGENT-CLONE-V1.json','utf8'));

for(const marker of [
  'FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1',
  'execution-agent-clone-v1',
  'flixo_agent_learning_events',
  'COGNITIVE_MESH_TARGET_SHA_REQUIRED',
]) assert.ok(sync.includes(marker), `missing sync marker ${marker}`);

for(const marker of [
  'AgentLearningCandidateSchema',
  'learning: AgentLearningCandidateSchema.nullable().optional()',
  'learning?: AgentLearningCandidate | null',
]) assert.ok(gateway.includes(marker), `missing gateway marker ${marker}`);

for(const marker of [
  'createExternalAgentLearning',
  'listExternalAgentLearning',
  'execution-agent-clone-v1',
]) assert.ok(api.includes(marker), `missing API learning marker ${marker}`);

assert.ok(prompt.includes('learning candidate'));
assert.equal(clone.role,'executionAgent');
assert.equal(clone.bidirectionalSync.cloneToSystem.enabled,true);
assert.equal(clone.bidirectionalSync.systemToClone.enabled,true);
console.log('EXTERNAL_AGENT_BIDIRECTIONAL_LEARNING_MESH_TEST=PASS');
