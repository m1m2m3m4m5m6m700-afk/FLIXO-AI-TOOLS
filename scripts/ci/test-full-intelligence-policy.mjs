#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FULL_INTELLIGENCE_PROTOCOL,
  FULL_INTELLIGENCE_VERSION,
  FULL_REASONING_MODE,
  FULL_REASONING_LENSES,
  FULL_REASONING_SEQUENCE,
  FULL_RESOURCE_POLICY,
  buildFullIntelligenceBootstrap,
  assertFullIntelligenceBootstrap,
} from './full-intelligence-policy.mjs';

const registry = JSON.parse(fs.readFileSync('docs/agents/FLIXO-BOT.json', 'utf8'));
const audience = [...new Set(registry.distribution.learningConsumers)];
const sha = 'a'.repeat(40);

assert.equal(FULL_INTELLIGENCE_PROTOCOL, 'FLIXO-FULL-INTELLIGENCE-v2');
assert.equal(FULL_INTELLIGENCE_VERSION, 'FLIXO-BOT-BRAIN-v2');
assert.equal(FULL_REASONING_MODE, 'FULL_ALWAYS');
assert.ok(FULL_REASONING_LENSES.length >= 30);
assert.equal(FULL_REASONING_SEQUENCE.at(0), 'OBSERVE');
assert.equal(FULL_REASONING_SEQUENCE.at(-1), 'VERIFY_EXACT_SHA_AND_LEARN');
assert.equal(FULL_RESOURCE_POLICY.noComplexityDowngrade, true);
assert.equal(FULL_RESOURCE_POLICY.reasoningEffort, 'MAXIMUM');
assert.equal(FULL_RESOURCE_POLICY.maxReasoningLoops, 12);
assert.ok(FULL_RESOURCE_POLICY.maxHypotheses >= 16);

const registryInternal = registry.distribution.systemWideInternalConsumers;
assert.equal(registryInternal.length, 76);
for (const agentId of [...new Set([...audience, ...registryInternal, 'ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3', 'FLIXO1', 'FLIXO10'])]) {
  const context = buildFullIntelligenceBootstrap({
    agentId,
    role: 'SYSTEM_AGENT',
    request: 'do a simple task',
    exactSha: sha,
    taskId: 'FULL-INTELLIGENCE-CONTRACT',
  });
  assertFullIntelligenceBootstrap(context, agentId);
  assert.equal(context.mode, 'FULL_ALWAYS');
  assert.equal(context.authority, 'CONTEXT_ONLY');
  assert.equal(context.mutationAuthority, false);
  assert.equal(context.certificationAuthority, false);
  assert.deepEqual(context.allLenses, FULL_REASONING_LENSES);
  assert.equal(context.collectiveMemory.protocol, 'FLIXO-SHARED-OPERATIONAL-MEMORY-v1');
  assert.equal(context.unifiedKernel.version, 'FLIXO-BOT-BRAIN-v2');
  assert.equal(context.overProvisionedCognition, true);
  assert.ok(context.capabilityIds.length >= 90);
}

console.log('FULL_INTELLIGENCE_CONTRACT=PASS');
