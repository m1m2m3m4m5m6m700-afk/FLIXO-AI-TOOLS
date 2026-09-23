#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildSharedLearningContext } from './shared-operational-memory.mjs';

const ROOT = process.cwd();
export const FULL_INTELLIGENCE_PROTOCOL = 'FLIXO-FULL-INTELLIGENCE-v1';
export const FULL_INTELLIGENCE_VERSION = 'FLIXO-BOT-BRAIN-v1';
export const FULL_REASONING_MODE = 'FULL_ALWAYS';

export const FULL_REASONING_LENSES = Object.freeze([
  'HUMAN_INTENT_MODELING',
  'EVIDENCE_PROVENANCE',
  'UNCERTAINTY_MODELING',
  'MINIMAL_CHANGE_SELECTION',
  'ROOT_CAUSE_ANALYSIS',
  'HYPOTHESIS_DISCRIMINATION',
  'ADVERSARIAL_FALSIFICATION',
  'DEPENDENCY_IMPACT_REASONING',
  'REGRESSION_REASONING',
  'SECURITY_BOUNDARY_REASONING',
  'RECOVERY_REASONING',
  'TEMPORAL_STATE_REASONING',
  'PERFORMANCE_REASONING',
  'LEARNING_AND_ANTI_LESSON',
]);

export const FULL_REASONING_SEQUENCE = Object.freeze([
  'OBSERVE',
  'INVENTORY',
  'CLASSIFY',
  'CORRELATE',
  'BUILD_WORLD_MODEL',
  'GENERATE_HYPOTHESES',
  'DISCRIMINATE_WITH_EVIDENCE',
  'CHALLENGE_ADVERSARIALLY',
  'SCOPE_MINIMAL_CHANGE',
  'SIMULATE_OR_PREDICT',
  'TARGETED_REGRESSION',
  'VERIFY_EXACT_SHA_AND_LEARN',
]);

export const FULL_RESOURCE_POLICY = Object.freeze({
  noComplexityDowngrade: true,
  reasoningEffort: 'MAXIMUM',
  maxReasoningLoops: 7,
  maxHypotheses: 8,
  sharedMemoryLimit: 128,
  exactShaRequired: true,
  freshEvidenceRequired: true,
  contradictionPreserved: true,
  failClosedOnUnknowns: true,
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
  const audience = Array.isArray(registry.distribution?.learningConsumers)
    ? [...new Set(registry.distribution.learningConsumers.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  if (!String(agentId ?? '').trim()) throw new Error('FULL_INTELLIGENCE_AGENT_ID_REQUIRED');
  if (!audience.includes(String(agentId).trim())) throw new Error('FULL_INTELLIGENCE_AGENT_NOT_IN_GLOBAL_AUDIENCE');
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
  if (!context.resources?.noComplexityDowngrade || context.resources.reasoningEffort !== 'MAXIMUM') throw new Error('FULL_INTELLIGENCE_RESOURCE_POLICY_DOWNGRADED');
  if (expectedAgentId && context.agentId !== expectedAgentId) throw new Error('FULL_INTELLIGENCE_AGENT_ID_MISMATCH');
  if (context.mutationAuthority === true || context.certificationAuthority === true) throw new Error('FULL_INTELLIGENCE_AUTHORITY_LEAK');
  validateSha(context.exactSha);
  return true;
}
