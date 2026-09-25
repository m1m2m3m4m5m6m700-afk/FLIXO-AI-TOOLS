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


export const CAUSAL_CLASSES = Object.freeze([
  'INTERNAL',
  'STALE',
  'EXTERNAL',
  'DOWNSTREAM',
  'CONTRACT',
  'RUNTIME',
  'UNKNOWN',
]);

export const ZERO_STALL_ACTIONS = Object.freeze([
  'REPAIR',
  'TARGETED_PROBE',
  'ESCALATE',
  'BLOCKED_EXTERNAL',
  'WAIT_FOR_FRESH_SHA',
]);

const CAUSAL_RULE_BEHAVIORS = Object.freeze({
  'exact-sha-before-rca': Object.freeze({
    classification: 'STALE',
    nextAction: 'WAIT_FOR_FRESH_SHA',
    forbiddenActions: ['MUTATE_BEFORE_EXACT_SHA'],
  }),
  'reject-stale-failure-targets': Object.freeze({
    classification: 'STALE',
    nextAction: 'WAIT_FOR_FRESH_SHA',
    forbiddenActions: ['MUTATE_INTERNAL_SOURCE', 'PROMOTE_HISTORICAL_PROOF'],
  }),
  'downstream-gate-not-root': Object.freeze({
    classification: 'DOWNSTREAM',
    nextAction: 'TARGETED_PROBE',
    forbiddenActions: ['REPAIR_DOWNSTREAM_SYMPTOM'],
  }),
  'sensitive-mutation-needs-proof': Object.freeze({
    classification: 'CONTRACT',
    nextAction: 'REPAIR',
    forbiddenActions: ['SILENCE_PROOF_GUARD'],
  }),
  'external-provider-isolation': Object.freeze({
    classification: 'EXTERNAL',
    nextAction: 'BLOCKED_EXTERNAL',
    forbiddenActions: ['MUTATE_INTERNAL_SOURCE'],
  }),
  'root-only-mutation': Object.freeze({
    classification: 'INTERNAL',
    nextAction: 'REPAIR',
    forbiddenActions: ['REPAIR_DOWNSTREAM_SYMPTOM'],
  }),
  'cancelled-run-classification': Object.freeze({
    classification: 'STALE',
    nextAction: 'WAIT_FOR_FRESH_SHA',
    forbiddenActions: ['MUTATE_INTERNAL_SOURCE', 'PROMOTE_HISTORICAL_PROOF'],
  }),
  'supersession-invalidates-proof': Object.freeze({
    classification: 'STALE',
    nextAction: 'WAIT_FOR_FRESH_SHA',
    forbiddenActions: ['PROMOTE_HISTORICAL_PROOF', 'CERTIFY_CURRENT_TARGET'],
  }),
  'first-causal-before-downstream': Object.freeze({
    classification: 'DOWNSTREAM',
    nextAction: 'TARGETED_PROBE',
    forbiddenActions: ['REPAIR_DOWNSTREAM_SYMPTOM'],
  }),
  'external-provider-separation': Object.freeze({
    classification: 'EXTERNAL',
    nextAction: 'BLOCKED_EXTERNAL',
    forbiddenActions: ['MUTATE_INTERNAL_SOURCE', 'MISLABEL_PROVIDER_FAILURE'],
  }),
  'preserve-external-evidence': Object.freeze({
    classification: 'EXTERNAL',
    nextAction: 'BLOCKED_EXTERNAL',
    forbiddenActions: ['MUTATE_INTERNAL_SOURCE'],
  }),
  'proof-chain-must-cover-mutation': Object.freeze({
    classification: 'CONTRACT',
    nextAction: 'REPAIR',
    forbiddenActions: ['SILENCE_PROOF_GUARD'],
  }),
  'classify-before-mutate': Object.freeze({
    classification: 'UNKNOWN',
    nextAction: 'TARGETED_PROBE',
    forbiddenActions: ['BLIND_MUTATION'],
  }),
  'never-stall-on-ambiguous-red': Object.freeze({
    classification: 'UNKNOWN',
    nextAction: 'TARGETED_PROBE',
    forbiddenActions: ['WAIT_INDEFINITELY', 'BLIND_MUTATION'],
  }),
  'no-identical-recursion': Object.freeze({
    classification: 'INTERNAL',
    nextAction: 'ESCALATE',
    forbiddenActions: ['REPEAT_IDENTICAL_REPAIR'],
  }),
});

const HISTORICAL_KNOWLEDGE_PATH = path.resolve('docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json');

export function loadHistoricalKnowledge(filePath = HISTORICAL_KNOWLEDGE_PATH) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(value?.entries) ? value.entries : [];
  } catch {
    return [];
  }
}

function normalizedText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function tokenSet(value) {
  return new Set(
    normalizedText(value)
      .replace(/[^a-z0-9_:-]+/giu, ' ')
      .split(/\s+/u)
      .filter((token) => token.length >= 3),
  );
}

function tokenOverlap(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits / Math.max(a.size, b.size);
}

function containsAny(value, needles) {
  const text = normalizedText(value);
  return needles.some((needle) => text.includes(needle));
}

export function buildCausalQuery(input = {}) {
  const features = input.features && typeof input.features === 'object' ? input.features : {};
  const query = {
    failureFingerprint: String(input.failureFingerprint ?? input.fingerprint ?? '').trim(),
    rootCause: String(input.rootCause ?? features.rootCause ?? '').trim(),
    failureClass: String(input.failureClass ?? features.failureClass ?? '').trim(),
    workflow: String(input.workflow ?? features.workflow ?? features.workflowName ?? '').trim(),
    workflowRole: String(input.workflowRole ?? features.workflowRole ?? '').trim(),
    firstFailingStep: String(input.firstFailingStep ?? features.firstFailingStep ?? '').trim(),
    cancellationReason: String(input.cancellationReason ?? features.cancellationReason ?? '').trim(),
    providerSignature: String(input.providerSignature ?? features.providerSignature ?? '').trim(),
    shaState: String(input.shaState ?? features.shaState ?? '').trim().toUpperCase(),
    currentSha: String(input.currentSha ?? '').trim(),
    evidenceSha: String(input.evidenceSha ?? input.targetSha ?? '').trim(),
    normalizedFailure: String(input.normalizedFailure ?? '').trim(),
    strategyId: String(input.strategyId ?? '').trim(),
    repeatedStrategy: input.repeatedStrategy === true,
    executionOutcome: String(input.executionOutcome ?? features.executionOutcome ?? '').trim(),
    diagnosticContract: String(input.diagnosticContract ?? features.diagnosticContract ?? '').trim(),
  };
  query.searchText = [
    query.failureFingerprint,
    query.rootCause,
    query.failureClass,
    query.workflow,
    query.workflowRole,
    query.firstFailingStep,
    query.cancellationReason,
    query.providerSignature,
    query.shaState,
    query.normalizedFailure,
    query.strategyId,
    query.executionOutcome,
    query.diagnosticContract,
  ].filter(Boolean).join(' ');
  return Object.freeze(query);
}

function evidenceShaIsStale(query) {
  return Boolean(query.currentSha && query.evidenceSha && SHA40.test(query.currentSha) && SHA40.test(query.evidenceSha) && query.currentSha !== query.evidenceSha);
}

export function classifyCausalEvidence(input = {}) {
  const query = buildCausalQuery(input);
  const combined = normalizedText(query.searchText);
  const branchIdentityMismatch = (
    /test\s+"(?!execution")[^"]+"\s*=\s*"execution"/u.test(combined) ||
    /test\s+"execution"\s*=\s*"(?!execution")[^"]+"/u.test(combined) ||
    containsAny(combined, ['branch identity mismatch', 'expected_branch mismatch', 'head_ref mismatch'])
  );
  const superseded = (
    ['MOVED', 'SUPERSEDED', 'STALE', 'LIVE_HEAD_MOVED'].includes(query.shaState) ||
    containsAny(query.cancellationReason, ['supersed', 'cancelled because', 'cancelled due to', 'newer sha', 'replacement sha']) ||
    containsAny(combined, ['live_head_moved=1', 'live_head_match=0']) ||
    branchIdentityMismatch ||
    evidenceShaIsStale(query)
  );
  if (superseded) {
    return Object.freeze({
      classification: 'STALE',
      confidence: 1,
      nextAction: 'WAIT_FOR_FRESH_SHA',
      mutationEligible: false,
      forbiddenActions: ['MUTATE_INTERNAL_SOURCE', 'PROMOTE_HISTORICAL_PROOF', 'CERTIFY_CURRENT_TARGET'],
      reason: 'current-target-evidence-is-superseded-or-stale',
      query,
    });
  }

  const external = (
    containsAny(query.providerSignature, ['503', 'provider', 'upstream unavailable', 'rate limit', 'timeout', 'model service']) ||
    containsAny(combined, [
      'http 503',
      'provider refused',
      'external runtime',
      'provider outage',
      'unable to resolve action',
      'provided ref',
      'github action resolution failed',
      'github api rate limit',
    ])
  );
  if (external) {
    return Object.freeze({
      classification: 'EXTERNAL',
      confidence: 0.98,
      nextAction: 'BLOCKED_EXTERNAL',
      mutationEligible: false,
      forbiddenActions: ['MUTATE_INTERNAL_SOURCE', 'MISLABEL_PROVIDER_FAILURE'],
      reason: 'external-provider-or-runtime-signature-present',
      query,
    });
  }

  const downstream = (
    containsAny(query.workflowRole, ['downstream']) ||
    Boolean(query.firstFailingStep && containsAny(query.firstFailingStep, ['require canonical workflow green', 'wait for upstream', 'blocked by', 'depends on'])) ||
    containsAny(query.normalizedFailure, ['upstream red', 'downstream of', 'blocked by upstream'])
  );
  if (downstream) {
    return Object.freeze({
      classification: 'DOWNSTREAM',
      confidence: 0.95,
      nextAction: 'TARGETED_PROBE',
      mutationEligible: false,
      forbiddenActions: ['REPAIR_DOWNSTREAM_SYMPTOM', 'MASS_PATCH_DEPENDENT_WORKFLOWS'],
      reason: 'evidence-indicates-downstream-symptom-not-causal-owner',
      query,
    });
  }

  const contract = (
    containsAny(query.rootCause, ['proof', 'contract', 'contract-drift', 'ownership']) ||
    containsAny(query.failureClass, ['contract', 'proof']) ||
    containsAny(combined, [
      'without proof',
      'proof coverage',
      'contract mismatch',
      'shared_source_missing',
      'certification-surface validator failed',
      'canonical certification-surface validator failed',
      'ci/cd trust failure',
      'schema_version',
    ])
  );
  if (contract) {
    return Object.freeze({
      classification: 'CONTRACT',
      confidence: 0.92,
      nextAction: 'REPAIR',
      mutationEligible: true,
      forbiddenActions: ['SILENCE_PROOF_GUARD'],
      reason: 'contract-or-proof-boundary-failure',
      query,
    });
  }

  const runtime = (
    containsAny(query.failureClass, ['runtime', 'browser']) ||
    containsAny(query.rootCause, ['runtime', 'browser']) ||
    containsAny(combined, ['browser runtime', 'worker crashed', 'runtime message'])
  );
  if (runtime) {
    return Object.freeze({
      classification: 'RUNTIME',
      confidence: 0.88,
      nextAction: 'REPAIR',
      mutationEligible: true,
      forbiddenActions: ['REPAIR_UNRELATED_WORKFLOW'],
      reason: 'runtime-boundary-failure',
      query,
    });
  }

  const explicitInternalEvidence = (
    containsAny(combined, [
      '##[error]src/',
      'error ts',
      'syntaxerror',
      'typeerror',
      'referenceerror',
      'module not found',
      'has no exported member',
      'is not assignable to type',
      'process completed with exit code 1',
      'process completed with exit code 2',
      'npm run typecheck',
      'npm run test:static',
      'npm run test:build',
    ])
  );
  const internal = Boolean(query.firstFailingStep || query.rootCause || query.failureClass || explicitInternalEvidence);
  if (internal && !query.repeatedStrategy) {
    return Object.freeze({
      classification: 'INTERNAL',
      confidence: 0.8,
      nextAction: 'REPAIR',
      mutationEligible: true,
      forbiddenActions: ['REPAIR_UNRELATED_DOWNSTREAM'],
      reason: 'direct-internal-failure-signal-present',
      query,
    });
  }

  if (query.repeatedStrategy) {
    return Object.freeze({
      classification: 'INTERNAL',
      confidence: 0.85,
      nextAction: 'ESCALATE',
      mutationEligible: false,
      forbiddenActions: ['REPEAT_IDENTICAL_REPAIR'],
      reason: 'identical-strategy-recurrence-requires-new-hypothesis',
      query,
    });
  }

  return Object.freeze({
    classification: 'UNKNOWN',
    confidence: 0.15,
    nextAction: 'TARGETED_PROBE',
    mutationEligible: false,
    forbiddenActions: ['BLIND_MUTATION', 'PROMOTE_HISTORICAL_PROOF'],
    reason: 'causal-evidence-insufficient',
    query,
  });
}

function candidateText(item) {
  return [
    item.id,
    item.fingerprint,
    item.rootCause,
    item.rule,
    item.claim,
    item.content,
    item.lesson,
    item.prevention,
    Array.isArray(item.preventionRules) ? item.preventionRules.join(' ') : '',
    Array.isArray(item.evidence?.workflowFamilies) ? item.evidence.workflowFamilies.join(' ') : '',
  ].filter(Boolean).join(' ');
}

function candidateRuleBehavior(item) {
  const behavior = CAUSAL_RULE_BEHAVIORS[String(item.rule ?? '').trim()];
  return behavior ? Object.freeze(behavior) : null;
}

function scoreCausalCandidate(item, query, decision = classifyCausalEvidence(query)) {
  const candidate = candidateText(item);
  let score = 0;
  if (query.failureFingerprint && String(item.fingerprint ?? '') === query.failureFingerprint) score += 1000;
  if (query.rootCause && normalizedText(item.rootCause) === normalizedText(query.rootCause)) score += 300;
  if (query.workflow && containsAny(candidate, [normalizedText(query.workflow)])) score += 140;
  if (query.workflowRole && tokenOverlap(query.workflowRole, candidate) >= 0.5) score += 110;
  if (query.firstFailingStep && tokenOverlap(query.firstFailingStep, candidate) >= 0.45) score += 120;
  if (query.providerSignature && tokenOverlap(query.providerSignature, candidate) >= 0.4) score += 120;
  if (query.failureClass && tokenOverlap(query.failureClass, candidate) >= 0.5) score += 100;
  if (query.shaState && tokenOverlap(query.shaState, candidate) >= 0.5) score += 80;
  if (query.strategyId && normalizedText(item.rule) === normalizedText(query.strategyId)) score += 160;
  if (query.searchText && tokenOverlap(query.searchText, candidate) >= 0.25) score += 40;
  const behavior = candidateRuleBehavior(item);
  if (behavior?.classification === decision.classification) score += 180;
  if (item.canonicalGreen === true || item.status === 'VERIFIED' || item.status === 'PROMOTED') score += 20;
  if (item.exactShaBound === true) score += 15;
  if (item.targetSha && query.currentSha && item.targetSha !== query.currentSha) score -= 80;
  return score;
}

function normalizeLearningCandidate(item, source) {
  const behavior = candidateRuleBehavior(item);
  return {
    ...item,
    source,
    causalBehavior: behavior,
    canonicalGreen: item.canonicalGreen === true,
    exactShaBound: item.exactShaBound === true,
    historicalOnly: item.status === 'PROVISIONAL_HISTORICAL_TEACHING' || item.status === 'LEGACY_CONTEXT' || item.canonicalGreen !== true,
  };
}

export function retrieveCausalLearning({
  memory = loadErrorMemory(),
  historical = loadHistoricalKnowledge(),
  sharedLearning = null,
  query = {},
  limit = 10,
} = {}) {
  const causalQuery = buildCausalQuery(query);
  const decision = classifyCausalEvidence(causalQuery);
  const candidates = [];
  const push = (item, source, anti = false) => {
    if (!item || typeof item !== 'object') return;
    const normalized = normalizeLearningCandidate({ ...item, anti: anti || item.anti === true }, source);
    candidates.push({
      item: normalized,
      score: scoreCausalCandidate(normalized, causalQuery, decision),
    });
  };

  for (const item of memory.cases ?? []) push(item, 'memory.case');
  for (const item of memory.lessons ?? []) push(item, 'memory.lesson');
  for (const item of memory.antiLessons ?? []) push(item, 'memory.antiLesson', true);
  for (const item of historical ?? []) push(item, 'historical-knowledge', false);
  for (const item of sharedLearning?.lessons ?? []) push(item, 'shared.lesson');
  for (const item of sharedLearning?.antiLessons ?? []) push(item, 'shared.antiLesson', true);

  const ranked = candidates
    .sort((a, b) => b.score - a.score)
    .filter((entry) => entry.score > 0)
    .slice(0, Math.max(1, Number(limit) || 10));

  const lessons = ranked.filter((entry) => !entry.item.anti).map((entry) => ({
    ...entry.item,
    retrievalScore: entry.score,
  }));
  const antiLessons = ranked.filter((entry) => entry.item.anti).map((entry) => ({
    ...entry.item,
    retrievalScore: entry.score,
  }));

  const zeroStall = ZERO_STALL_ACTIONS.includes(decision.nextAction);
  if (!zeroStall) throw new Error('CAUSAL_RETRIEVAL_ZERO_STALL_ACTION_INVALID');

  return Object.freeze({
    query: causalQuery,
    decision,
    ranked,
    lessons,
    antiLessons,
    zeroStall: true,
    historicalKnowledgeIsAdvisory: lessons.some((item) => item.historicalOnly) || antiLessons.some((item) => item.historicalOnly),
    sourceCounts: ranked.reduce((acc, entry) => {
      acc[entry.item.source] = (acc[entry.item.source] ?? 0) + 1;
      return acc;
    }, {}),
  });
}


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

export function discoverPromptContext({
  registry,
  memory = loadErrorMemory(),
  failureFingerprint = '',
  rootCause = '',
  failureClass = '',
  workflow = '',
  workflowRole = '',
  firstFailingStep = '',
  cancellationReason = '',
  providerSignature = '',
  shaState = '',
  currentSha = '',
  evidenceSha = '',
  normalizedFailure = '',
  strategyId = '',
  repeatedStrategy = false,
} = {}) {
  const matchingCase = (memory.cases ?? []).find((item) => item.fingerprint === failureFingerprint) ?? null;
  const causalRetrieval = retrieveCausalLearning({
    memory,
    query: {
      failureFingerprint,
      rootCause,
      failureClass,
      workflow,
      workflowRole,
      firstFailingStep,
      cancellationReason,
      providerSignature,
      shaState,
      currentSha,
      evidenceSha,
      normalizedFailure,
      strategyId,
      repeatedStrategy,
    },
    limit: 20,
  });
  const similarCases = (memory.cases ?? [])
    .filter((item) => item.fingerprint !== failureFingerprint)
    .filter((item) => (!rootCause || item.rootCause === rootCause))
    .slice(-10);
  const selection = selectRepairPrompt({ registry, failureFingerprint, rootCause, failureClass });
  return {
    memoryIsAdvisoryOnly: true,
    matchingCase,
    similarCases,
    lessons: causalRetrieval.lessons.slice(0, 10),
    antiLessons: causalRetrieval.antiLessons.slice(0, 10),
    causalRetrieval,
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

  // The repository has exactly one canonical active execution prompt.
  // A broad unified prompt may own uncatalogued causal variants without
  // creating prompt-per-error specialists.
  if (
    active.length === 1 &&
    (
      active[0].failureClasses.includes('ALL_REPAIRABLE') ||
      active[0].rootCauses.includes('ANY_CONFIRMED_RCA')
    )
  ) {
    return { status: 'REUSE', prompt: active[0], validation };
  }

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
