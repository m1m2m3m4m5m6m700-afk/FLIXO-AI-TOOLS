#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildSharedLearningContext } from './shared-operational-memory.mjs';

export const EXECUTION_AGENT_CLONE_ID = 'execution-agent-clone-v1';
export const EXECUTION_AGENT_CLONE_ROLE = 'executionAgent';
export const COGNITIVE_MESH_PROTOCOL = 'FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1';
export const FLIXO_BOT_BRAIN_VERSION = 'FLIXO-BOT-BRAIN-v1';
export const REGISTRY_PATH = 'docs/agents/FLIXO-BOT.json';
export const CLONE_PATH = 'docs/agents/EXECUTION-AGENT-CLONE-V1.json';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const currentSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

export function buildExecutionAgentCloneContext({ targetSha = currentSha(), limit = 96 } = {}) {
  if (!/^[a-f0-9]{40}$/u.test(String(targetSha))) {
    throw new Error('EXECUTION_AGENT_CLONE_EXACT_SHA_REQUIRED');
  }
  const registry = readJson(REGISTRY_PATH);
  const clone = readJson(CLONE_PATH);
  if (clone.id !== EXECUTION_AGENT_CLONE_ID) throw new Error('EXECUTION_AGENT_CLONE_ID_INVALID');
  if (clone.role !== EXECUTION_AGENT_CLONE_ROLE || clone.rolePreserved !== true) {
    throw new Error('EXECUTION_AGENT_CLONE_ROLE_INVALID');
  }
  if (clone.intelligence?.version !== FLIXO_BOT_BRAIN_VERSION) {
    throw new Error('EXECUTION_AGENT_CLONE_BRAIN_VERSION_INVALID');
  }
  if (registry.intelligenceVersion !== FLIXO_BOT_BRAIN_VERSION) {
    throw new Error('FLIXO_BOT_BRAIN_VERSION_REGISTRY_INVALID');
  }
  const consumers = registry?.distribution?.learningConsumers;
  if (!Array.isArray(consumers) || !consumers.includes(EXECUTION_AGENT_CLONE_ID)) {
    throw new Error('EXECUTION_AGENT_CLONE_GLOBAL_AUDIENCE_MISSING');
  }
  const sharedLearning = buildSharedLearningContext({ limit });
  return Object.freeze({
    schemaVersion: 1,
    protocol: COGNITIVE_MESH_PROTOCOL,
    cloneId: EXECUTION_AGENT_CLONE_ID,
    role: EXECUTION_AGENT_CLONE_ROLE,
    targetSha: String(targetSha),
    brain: {
      version: registry.intelligenceVersion,
      model: registry.architecture?.mode ?? null,
      capabilityCount: registry.mergedIntelligence?.capabilityCount ?? null,
      capabilities: Object.freeze([...(registry.mergedIntelligence?.capabilities ?? [])]),
      registry: REGISTRY_PATH,
    },
    sharedLearning,
    sync: {
      cloneToSystem: true,
      systemToClone: true,
      allActiveConsumersShareTheSameBrain: registry?.architecture?.commonIntelligence === true,
      allActiveConsumersShareTheSameMemory: registry?.architecture?.commonMemory === true,
      knowledgeOnly: true,
      noAuthorityTransfer: clone.authority?.knowledgeDoesNotGrantAuthority === true,
    },
  });
}

export function validateExecutionAgentClone() {
  const context = buildExecutionAgentCloneContext();
  const failures = [];
  if (context.role !== EXECUTION_AGENT_CLONE_ROLE) failures.push('ROLE_INVALID');
  if (context.brain.version !== FLIXO_BOT_BRAIN_VERSION) failures.push('BRAIN_VERSION_INVALID');
  if (!context.sync.cloneToSystem || !context.sync.systemToClone) failures.push('BIDIRECTIONAL_SYNC_INVALID');
  if (!context.sync.allActiveConsumersShareTheSameBrain) failures.push('COMMON_INTELLIGENCE_INVALID');
  if (!context.sync.allActiveConsumersShareTheSameMemory) failures.push('COMMON_MEMORY_INVALID');
  if (!context.sync.knowledgeOnly || !context.sync.noAuthorityTransfer) failures.push('AUTHORITY_BOUNDARY_INVALID');
  return Object.freeze({ status: failures.length ? 'FAIL' : 'PASS', targetSha: context.targetSha, failures, context });
}

if (process.argv[1]?.endsWith('execution-agent-cognitive-sync.mjs')) {
  const result = validateExecutionAgentClone();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exit(1);
}
