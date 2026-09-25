#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildSharedLearningContext } from './shared-operational-memory.mjs';

const ROOT = process.cwd();
export const FULL_INTELLIGENCE_PROTOCOL = 'FLIXO-FULL-INTELLIGENCE-v2';
export const FULL_INTELLIGENCE_VERSION = 'FLIXO-BOT-BRAIN-v2';
export const FULL_REASONING_MODE = 'FULL_ALWAYS';

function readRegistry() {
  const file = path.resolve(ROOT, 'docs/agents/FLIXO-BOT.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readUnifiedRegistryKernel() {
  return readRegistry().unifiedCognitiveKernel;
}

const UNIFIED_KERNEL = readUnifiedRegistryKernel();

export const FULL_REASONING_LENSES = Object.freeze([...(UNIFIED_KERNEL.reasoningLenses ?? [])]);
export const FULL_REASONING_SEQUENCE = Object.freeze([...(UNIFIED_KERNEL.reasoningSequence ?? [])]);
export const FULL_RESOURCE_POLICY = Object.freeze({
  ...(UNIFIED_KERNEL.resourcePolicy ?? {}),
  noComplexityDowngrade: true,
  reasoningEffort: 'MAXIMUM',
  sharedMemoryLimit: Math.max(128, Number(UNIFIED_KERNEL.resourcePolicy?.sharedMemoryLimit ?? 128)),
});
export const FULL_GUARDRAILS = Object.freeze([
  'NO_BLIND_RETRY',
  'NO_HIDDEN_AUTHORITY_TRANSFER',
  'NO_EXECUTOR_DUPLICATION',
  'NO_DIRECT_MAIN_MUTATION',
  'NO_SKIPPED_VERIFICATION',
  'FAIL_CLOSED_ON_UNCERTAINTY',
]);

function readRegistry() {
  const file = path.resolve(ROOT, 'docs/agents/FLIXO-BOT.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateSha(value) {
  const sha = String(value ?? '').trim();
  if (!/^[a-f0-9]{40}$/u.test(sha)) throw new Error('FULL_INTELLIGENCE_EXACT_SHA_REQUIRED');
  return sha;
}

export function buildFullIntelligenceBootstrap({
  agentId,
  role = null,
  request = '',
  exactSha,
  taskId,
} = {}) {
  const registry = readRegistry();
  const learningConsumers = Array.isArray(registry.distribution?.learningConsumers)
    ? registry.distribution.learningConsumers
    : [];
  const internalConsumers = Array.isArray(registry.distribution?.systemWideInternalConsumers)
    ? registry.distribution.systemWideInternalConsumers
    : [];
  const activeAudience = registry.activeMembers && typeof registry.activeMembers === 'object' && !Array.isArray(registry.activeMembers)
    ? Object.values(registry.activeMembers).flatMap((value) => Array.isArray(value) ? value : [])
    : [];
  const aliasMap = registry.aliases && typeof registry.aliases === 'object' && !Array.isArray(registry.aliases)
    ? registry.aliases
    : {};
  const globalAudience = new Set(
    [...learningConsumers, ...internalConsumers, ...activeAudience]
      .map((value) => String(value).trim())
      .filter(Boolean),
  );
  const kernel = registry.unifiedCognitiveKernel;
  if (!kernel || kernel.version !== FULL_INTELLIGENCE_VERSION) throw new Error('FULL_INTELLIGENCE_UNIFIED_KERNEL_MISSING');
  const normalizedAgentId = String(agentId ?? '').trim();
  const canonicalAgentId = String(aliasMap[normalizedAgentId] ?? normalizedAgentId).trim();
  if (!normalizedAgentId) throw new Error('FULL_INTELLIGENCE_AGENT_ID_REQUIRED');
  if (!globalAudience.has(canonicalAgentId)) throw new Error('FULL_INTELLIGENCE_AGENT_NOT_IN_GLOBAL_AUDIENCE');
  if (!String(taskId ?? '').trim()) throw new Error('FULL_INTELLIGENCE_TASK_REQUIRED');

  const sha = validateSha(exactSha);
  const sharedLearning = buildSharedLearningContext({
    botId: String(agentId).trim(),
    limit: FULL_RESOURCE_POLICY.sharedMemoryLimit,
    currentSha: null,
  });

  return Object.freeze({
    protocol: FULL_INTELLIGENCE_PROTOCOL,
    version: FULL_INTELLIGENCE_VERSION,
    mode: FULL_REASONING_MODE,
    agentId: String(agentId).trim(),
    role: role ? String(role).trim() : null,
    taskId: String(taskId).trim(),
    exactSha: sha,
    request: String(request ?? '').trim(),
    allLenses: FULL_REASONING_LENSES,
    reasoningSequence: FULL_REASONING_SEQUENCE,
    resources: FULL_RESOURCE_POLICY,
    capabilityIds: Object.freeze([...(kernel.capabilities ?? [])]),
    unifiedKernel: kernel,
    overProvisionedCognition: kernel.overProvisionedCognition === true,
    internalConsumerCount: internalConsumers.length,
    roleOverlayPolicy: kernel.roleOverlayPolicy ?? null,
    guardrails: FULL_GUARDRAILS,
    collectiveMemory: sharedLearning,
    authority: 'CONTEXT_ONLY',
    mutationAuthority: false,
    certificationAuthority: false,
    learningAuthority: 'KNOWLEDGE_ONLY',
    note: 'Task simplicity NEVER reduces the cognitive substrate. Role permissions remain independently enforced.',
  });
}

export function assertFullIntelligenceBootstrap(context, expectedAgentId = null) {
  if (!context || context.protocol !== FULL_INTELLIGENCE_PROTOCOL) throw new Error('FULL_INTELLIGENCE_BOOTSTRAP_INVALID');
  if (context.version !== FULL_INTELLIGENCE_VERSION) throw new Error('FULL_INTELLIGENCE_VERSION_MISMATCH');
  if (context.mode !== FULL_REASONING_MODE) throw new Error('FULL_INTELLIGENCE_MODE_DOWNGRADE');
  if (!Array.isArray(context.allLenses) || context.allLenses.length < FULL_REASONING_LENSES.length) throw new Error('FULL_INTELLIGENCE_LENS_SET_INCOMPLETE');
  if (!Array.isArray(context.capabilityIds) || context.capabilityIds.length < 90) throw new Error('FULL_INTELLIGENCE_CAPABILITY_SET_INCOMPLETE');
  if (context.overProvisionedCognition !== true) throw new Error('FULL_INTELLIGENCE_OVERPROVISIONING_DISABLED');
  if (!context.resources?.noComplexityDowngrade || context.resources.reasoningEffort !== 'MAXIMUM') throw new Error('FULL_INTELLIGENCE_RESOURCE_POLICY_DOWNGRADED');
  if (expectedAgentId && context.agentId !== expectedAgentId) throw new Error('FULL_INTELLIGENCE_AGENT_ID_MISMATCH');
  if (context.mutationAuthority === true || context.certificationAuthority === true) throw new Error('FULL_INTELLIGENCE_AUTHORITY_LEAK');
  validateSha(context.exactSha);
  return true;
}
