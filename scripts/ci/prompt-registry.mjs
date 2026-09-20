#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const PROMPT_REGISTRY_PATH = path.resolve('docs/agents/PROMPT-REGISTRY.json');
export const PROMPT_STATUS = Object.freeze(new Set([
  'ACTIVE', 'CANDIDATE', 'MERGED', 'DEPRECATED', 'BLOCKED', 'SUPERSEDED',
]));
const SHA40 = /^[a-f0-9]{40}$/u;

export function loadPromptRegistry(filePath = PROMPT_REGISTRY_PATH) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadErrorMemory(filePath = path.resolve('diagnostics/auto-repair/memory.json')) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const uniqueSorted = (value = []) =>
  [...new Set((Array.isArray(value) ? value : [value]).map(String).filter(Boolean))].sort();

export function causalIdentity(prompt) {
  const payload = {
    failureClasses: uniqueSorted(prompt.failureClasses),
    rootCauses: uniqueSorted(prompt.rootCauses),
    scope: typeof prompt.scope === 'string'
      ? prompt.scope.trim()
      : {
          allowed: uniqueSorted(prompt.scope?.allowed),
          forbidden: uniqueSorted(prompt.scope?.forbidden),
          protected: uniqueSorted(prompt.scope?.protected),
        },
    repairStrategy: uniqueSorted(prompt.repairStrategy),
    verificationPlan: uniqueSorted(prompt.verificationPlan),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

function validateExactSha(item, errors) {
  const rule = item.exactShaRequirements;
  if (Array.isArray(rule)) {
    const values = new Set(rule.map((value) => String(value).trim()).filter(Boolean));
    for (const required of ['current execution SHA', 'invalidate on SHA change', 'targeted verification', 'affected graph verification', 'canonical certification']) {
      if (!values.has(required)) errors.push(item.promptId + ': exact-SHA requirement missing: ' + required);
    }
    return;
  }
  if (!rule?.required || rule.bindAtExecution !== true || rule.historicalProvenanceIsNotProof !== true) {
    errors.push(item.promptId + ': exact-SHA binding is incomplete');
  }
  if (!String(rule?.source ?? '').trim() || !String(rule?.mustEqual ?? '').trim()) {
    errors.push(item.promptId + ': exact-SHA binding source/equality contract is incomplete');
  }
}

export function validatePromptRegistry(registry) {
  const errors = [];
  const warnings = [];
  if (registry?.schemaVersion !== 1) errors.push('schema-version-mismatch');
  if (registry?.authority !== 'PROMPT_INTELLIGENCE_LAYER') errors.push('authority-mismatch');
  if (!Array.isArray(registry?.prompts) || registry.prompts.length === 0) errors.push('empty-prompt-registry');

  const ids = new Set();
  const paths = new Set();
  const causalOwners = new Map();
  const fingerprintOwners = new Map();

  for (const item of registry.prompts ?? []) {
    if (!PROMPT_STATUS.has(item.status)) errors.push(item.promptId + ': invalid status');
    if (!String(item.promptId ?? '').startsWith('RPR-')) errors.push(item.promptId + ': invalid promptId');
    if (!String(item.title ?? '').trim()) errors.push(item.promptId + ': title required');
    const sourcePath = String(item.sourcePath ?? item.path ?? '').trim();
    if (!sourcePath) errors.push(item.promptId + ': sourcePath required');
    if (ids.has(item.promptId)) errors.push(item.promptId + ': duplicate promptId');
    ids.add(item.promptId);
    if (sourcePath && paths.has(sourcePath)) errors.push(item.promptId + ': duplicate sourcePath');
    if (sourcePath) paths.add(sourcePath);

    if (sourcePath && !fs.existsSync(path.resolve(sourcePath))) errors.push(item.promptId + ': prompt file missing: ' + sourcePath);

    for (const field of [
      'failureClasses', 'fingerprints', 'rootCauses', 'repairStrategy', 'verificationPlan',
      'learningRequirements', 'relatedPrompts', 'supersedes', 'supersededBy', 'antiPatterns',
    ]) {
      if (!Array.isArray(item[field])) errors.push(item.promptId + ': ' + field + ' must be an array');
    }
    if (typeof item.scope !== 'string' && item.scope && typeof item.scope === 'object') {
      for (const field of ['allowed', 'forbidden', 'protected', 'verificationBoundary']) {
        if (item.scope[field] !== undefined && !Array.isArray(item.scope[field])) {
          errors.push(item.promptId + ': scope.' + field + ' must be an array');
        }
      }
    }
    for (const fingerprint of item.fingerprints ?? []) {
      if (!String(fingerprint ?? '').trim()) errors.push(item.promptId + ': empty fingerprint');
    }

    validateExactSha(item, errors);
    const key = causalIdentity(item);
    if (item.causalKey && item.causalKey !== key) errors.push(item.promptId + ': causalKey mismatch');
    item.causalKey = key;

    if (['ACTIVE', 'CANDIDATE'].includes(item.status)) {
      const prior = causalOwners.get(key);
      if (prior && prior !== item.promptId) errors.push('PROMPT_DUPLICATE_CAUSAL_KEY:' + prior + ':' + item.promptId);
      else causalOwners.set(key, item.promptId);

      for (const fingerprint of item.fingerprints ?? []) {
        const owner = fingerprintOwners.get(fingerprint);
        if (owner && owner !== item.promptId) {
          errors.push('PROMPT_OVERLAP_FINGERPRINT:' + fingerprint + ':' + owner + ':' + item.promptId);
        } else {
          fingerprintOwners.set(fingerprint, item.promptId);
        }
      }
    }
  }

  for (const required of [
    'schema-complete',
    'no-active-duplicates',
    'source-path-exists',
    'overlap-reviewed',
    'exact-sha-bound',
  ]) {
    if (!registry.promptQualityGate?.includes(required)) errors.push('missing-quality-gate:' + required);
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? (warnings.length ? 'PROMPT_REVIEW_REQUIRED' : 'VALID') : 'PROMPT_REVIEW_REQUIRED',
    errors,
    warnings,
    promptCount: registry.prompts?.length ?? 0,
  };
}

export function discoverPromptContext({ registry, memory = loadErrorMemory(), failureFingerprint = '', rootCause = '', failureClass = '' } = {}) {
  const matchingCase = (memory.cases ?? []).find((item) => item.fingerprint === failureFingerprint) ?? null;
  const similarCases = (memory.cases ?? [])
    .filter((item) => item.fingerprint !== failureFingerprint)
    .filter((item) => (!rootCause || item.rootCause === rootCause))
    .slice(-10);
  const lessons = (memory.lessons ?? []).filter((item) =>
    (!rootCause || item.rootCause === rootCause) &&
    (!failureFingerprint || item.fingerprint === failureFingerprint || item.fingerprint === matchingCase?.fingerprint)
  ).slice(-10);
  const antiLessons = (memory.antiLessons ?? []).filter((item) =>
    (!rootCause || item.rootCause === rootCause) &&
    (!failureFingerprint || item.fingerprint === failureFingerprint || item.fingerprint === matchingCase?.fingerprint)
  ).slice(-10);
  const selection = selectRepairPrompt({ registry, failureFingerprint, rootCause, failureClass });
  return {
    memoryIsAdvisoryOnly: true,
    matchingCase,
    similarCases,
    lessons,
    antiLessons,
    selection,
  };
}

export function selectRepairPrompt({ registry, failureFingerprint = '', rootCause = '', failureClass = '' } = {}) {
  const validation = validatePromptRegistry(registry);
  if (!validation.ok) return { status: 'PROMPT_REVIEW_REQUIRED', validation };
  const active = registry.prompts.filter((item) => item.status === 'ACTIVE');
  const exact = active.filter((item) => item.fingerprints.includes(failureFingerprint));
  if (exact.length === 1) return { status: 'REUSE', prompt: exact[0], validation };
  if (exact.length > 1) return {
    status: 'PROMPT_REVIEW_REQUIRED',
    reason: 'multiple-fingerprint-owners',
    candidates: exact.map((item) => item.promptId),
    validation,
  };

  const causal = active.filter((item) =>
    item.rootCauses.includes(rootCause) &&
    (!failureClass || item.failureClasses.includes(failureClass))
  );
  if (causal.length === 1) return { status: 'REUSE', prompt: causal[0], validation };
  if (causal.length > 1) return {
    status: 'PROMPT_REVIEW_REQUIRED',
    reason: 'overlapping-causal-prompts',
    candidates: causal.map((item) => item.promptId),
    validation,
  };
  return { status: 'PROMPT_REVIEW_REQUIRED', reason: 'no-active-causal-prompt', validation };
}

export function createPromptHandoff({
  registry, promptId, exactSha, failureFingerprint, rootCause,
  evidence = [], relatedPrompts = [], conflicts = [], nextPromptId = null,
} = {}) {
  if (!String(promptId ?? '').trim()) throw new Error('PROMPT_ID_REQUIRED');
  if (!SHA40.test(String(exactSha ?? ''))) throw new Error('PROMPT_HANDOFF_EXACT_SHA_INVALID');
  if (!String(failureFingerprint ?? '').trim()) throw new Error('PROMPT_HANDOFF_FINGERPRINT_REQUIRED');
  if (!String(rootCause ?? '').trim()) throw new Error('PROMPT_HANDOFF_ROOT_CAUSE_REQUIRED');

  const prompt = (registry.prompts ?? []).find((item) => item.promptId === promptId && item.status === 'ACTIVE');
  if (!prompt) throw new Error('PROMPT_HANDOFF_PROMPT_NOT_ACTIVE');

  const validation = validatePromptRegistry(registry);
  if (!validation.ok) throw new Error('PROMPT_HANDOFF_REGISTRY_INVALID');

  const allowedScope = typeof prompt.scope === 'string'
    ? [prompt.scope]
    : [...(prompt.scope?.allowed ?? [])];
  const forbiddenScope = typeof prompt.scope === 'string'
    ? []
    : [...(prompt.scope?.forbidden ?? [])];

  return {
    promptId,
    exactSha,
    failureFingerprint,
    rootCause,
    agentRole: prompt.agentRole,
    mission: prompt.title,
    evidence,
    allowedScope,
    forbiddenScope,
    repairSequence: ['READ', 'IDENTIFY', 'FINGERPRINT', 'RCA', 'FALSIFY', 'REPRODUCE', 'PLAN', 'RISK_GATE', 'REPAIR'],
    verificationSequence: prompt.verificationPlan,
    learningSequence: prompt.learningRequirements,
    relatedPrompts: [...new Set([...(prompt.relatedPrompts ?? []), ...relatedPrompts])],
    antiLessons: prompt.antiPatterns,
    conflicts,
    nextPromptId,
    provenance: {
      registry: 'docs/agents/PROMPT-REGISTRY.json',
      registrySourceSha: registry.provenance?.inventoryBaselineSha ?? null,
      evidenceIsCurrentOnlyWhenBoundToExactSha: true,
    },
    status: 'CANDIDATE',
  };
}

export function classifyPromptLearningOutcome(outcome) {
  if (outcome === 'success') return 'LESSON_CANDIDATE';
  if (['failure', 'unrepaired', 'blocked'].includes(outcome)) return 'ANTI_LESSON_CANDIDATE';
  if (['reverted-repair', 'revert-failure'].includes(outcome)) return 'STRATEGY_REJECTION_SIGNAL';
  if (outcome === 'proposed') return 'NO_SUCCESS_CONFIDENCE';
  if (outcome === 'blocked-external') return 'BLOCKED_EXTERNAL';
  return 'PROMPT_REVIEW_REQUIRED';
}

if (process.argv[1]?.endsWith('prompt-registry.mjs') && process.argv.includes('validate')) {
  const result = validatePromptRegistry(loadPromptRegistry());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
