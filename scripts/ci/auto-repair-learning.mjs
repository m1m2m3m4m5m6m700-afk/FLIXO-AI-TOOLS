import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { normalizeFailure, fingerprintFailure, extractFeatures } from './auto-repair/fingerprint.mjs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
const intractablePath = process.env.FLIXO_INTRACTABLE_ERRORS ?? 'diagnostics/auto-repair/intractable-errors.json';
export const MEMORY_VERSION = 10;
export const INTRACTABLE_THRESHOLD = 3;
export { normalizeFailure, fingerprintFailure, extractFeatures };

export function externalProviderSignature(text = '') {
  const input = String(text ?? '');
  const model = input.match(/COPILOT_AGENT_MODEL:\s*([^\r\n]+)/i)?.[1]?.trim() ?? null;
  const api = input.match(/COPILOT_API_URL:\s*(https?:\/\/[^\s\r\n]+)/i)?.[1]?.trim() ?? null;
  const error = input.match(/CAPIError:\s*400\s+The requested model is not supported/i)?.[0]?.trim() ?? null;
  return [model, api, error].filter(Boolean).join('|') || null;
}

export function normalizeLearningOutcome(outcome, verification) {
  if (outcome === 'unrepaired' && (verification === 'proposal-only' || verification === 'diagnostic-only')) return 'proposed';
  return outcome;
}

const emptyMemory = () => ({ version: MEMORY_VERSION, cases: [], playbooks: [], lessons: [], antiLessons: [], actionHistory: [] });

const historicalKnowledgePath = process.env.FLIXO_HISTORICAL_KNOWLEDGE ?? 'docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json';

function loadHistoricalKnowledge() {
  if (!fs.existsSync(historicalKnowledgePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(historicalKnowledgePath, 'utf8'));
    return Array.isArray(parsed?.entries) ? parsed.entries.filter((entry) =>
      entry?.id && entry?.rootCause && entry?.rule && Array.isArray(entry?.evidence)
    ) : [];
  } catch {
    return [];
  }
}

export function loadMemory() {
  const trustedSourcePath = process.env.FLIXO_TRUSTED_REPAIR_MEMORY || memoryPath;
  if (!fs.existsSync(trustedSourcePath)) return emptyMemory();
  try {
    const parsed = JSON.parse(fs.readFileSync(trustedSourcePath, 'utf8'));
    let memory = normalizeMemoryCounters({ ...emptyMemory(), ...parsed });
    const derivedPath = process.env.FLIXO_DERIVED_REPAIR_MEMORY;
    if (process.env.FLIXO_TRUSTED_REPAIR_MEMORY && derivedPath && fs.existsSync(derivedPath) && derivedPath !== trustedSourcePath) {
      try {
        const derived = JSON.parse(fs.readFileSync(derivedPath, 'utf8'));
        memory = mergeMemoryHistory(memory, derived);
      } catch {
        // Derived execution memory is supplemental evidence; trusted memory remains authoritative.
      }
    }
    memory.version = Number.isInteger(parsed?.version) ? Math.max(parsed.version, MEMORY_VERSION) : MEMORY_VERSION;
    for (const key of ['cases', 'playbooks', 'lessons', 'antiLessons', 'actionHistory']) if (!Array.isArray(memory[key])) memory[key] = [];
    return memory;
  } catch {
    return emptyMemory();
  }
}

function emptyIntractable() {
  return { version: 1, threshold: INTRACTABLE_THRESHOLD, protocol: 'SUPERVISING-REPAIR-TEACHING-v1', cases: [] };
}

function loadIntractable() {
  if (!fs.existsSync(intractablePath)) return emptyIntractable();
  try {
    const parsed = JSON.parse(fs.readFileSync(intractablePath, 'utf8'));
    return { ...emptyIntractable(), ...parsed, threshold: INTRACTABLE_THRESHOLD, protocol: 'SUPERVISING-REPAIR-TEACHING-v1' };
  } catch {
    return emptyIntractable();
  }
}

function writeIntractable(data) {
  fs.mkdirSync(intractablePath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(intractablePath, `${JSON.stringify(data, null, 2)}\n`);
}

function publishIntractableRecord(record) {
  // The repair protocol is intentionally two-branch only. Intractable state is
  // retained in the repair artifact/memory path and escalated without creating
  // a third Git branch or mutating main.
  console.warn('INTRACTABLE_ESCALATION_RECORDED=' + record.fingerprint);
}
function priorRepairArtifactCount() {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const targetRunId = process.env.FLIXO_RUN_ID;
  if (!token || !repo || !targetRunId) return 0;
  const result = spawnSync('gh', ['api', `repos/${repo}/actions/artifacts`, '--paginate', '--slurp', '--jq', '.[].artifacts[].name'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) return 0;
  const prefix = `flixo-auto-repair-${targetRunId}-`;
  return result.stdout.split('\n').filter((name) => name.startsWith(prefix)).length;
}

export function normalizeCaseCounters(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const attempts = Math.max(0, Number(entry.attempts ?? 0));
  const successes = Math.max(0, Number(entry.successes ?? 0));
  const failures = Math.max(0, Number(entry.failures ?? 0));
  if (successes + failures <= attempts) {
    return { ...entry, attempts, successes, failures };
  }
  const observedSuccesses = (entry.outcomes ?? []).filter((item) =>
    item?.outcome === 'success' || (item?.outcome === 'repair' && item?.verification === 'success')
  ).length;
  const observedFailures = (entry.outcomes ?? []).filter((item) =>
    ['failure', 'unrepaired', 'blocked'].includes(item?.outcome) ||
    (item?.outcome === 'repair' && item?.verification !== 'success' && item?.verification !== 'proposal-only' && item?.verification !== 'diagnostic-only')
  ).length;
  const repairedSuccesses = Math.max(successes, observedSuccesses);
  const repairedAttempts = Math.max(attempts, repairedSuccesses);
  const repairedFailures = Math.min(Math.max(failures, observedFailures), Math.max(0, repairedAttempts - repairedSuccesses));
  return {
    ...entry,
    attempts: repairedAttempts,
    successes: Math.min(repairedSuccesses, repairedAttempts),
    failures: repairedFailures,
  };
}

export function normalizeMemoryCounters(memory) {
  const source = { ...emptyMemory(), ...memory };
  source.cases = (source.cases ?? []).map(normalizeCaseCounters);
  return source;
}

export function mergeMemoryHistory(baseMemory, derivedMemory) {
  const base = normalizeMemoryCounters({ ...emptyMemory(), ...(baseMemory ?? {}) });
  const derived = normalizeMemoryCounters({ ...emptyMemory(), ...(derivedMemory ?? {}) });
  const merged = {
    ...base,
    version: Math.max(Number(base.version ?? 0), Number(derived.version ?? 0), MEMORY_VERSION),
    cases: [...base.cases],
    playbooks: [...base.playbooks],
    lessons: [...base.lessons],
    antiLessons: [...base.antiLessons],
    actionHistory: [...(base.actionHistory ?? [])],
  };

  const mergeUnique = (left = [], right = [], keyFor = (item) => JSON.stringify(item)) => {
    const out = [...left];
    const seen = new Set(out.map(keyFor));
    for (const item of right) {
      const key = keyFor(item);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  };

  const caseMap = new Map(merged.cases.map((item) => [item.fingerprint, item]));
  for (const incoming of derived.cases) {
    const existing = caseMap.get(incoming.fingerprint);
    if (!existing) {
      caseMap.set(incoming.fingerprint, normalizeCaseCounters(incoming));
      continue;
    }
    existing.rootCause = existing.rootCause && existing.rootCause !== 'unknown' ? existing.rootCause : incoming.rootCause;
    existing.normalizedFailure = incoming.normalizedFailure ?? existing.normalizedFailure;
    existing.features = [...new Set([...(existing.features ?? []), ...(incoming.features ?? [])])];
    existing.rules = [...new Set([...(existing.rules ?? []), ...(incoming.rules ?? [])])];
    existing.outcomes = mergeUnique(existing.outcomes, incoming.outcomes, (item) => [
      item?.outcome, item?.verification, item?.rule, item?.provenance?.runId,
      item?.provenance?.failedSha, item?.provenance?.targetSha, item?.at,
    ].map((value) => String(value ?? '')).join('|')).slice(-20);
    existing.attempts = Math.max(Number(existing.attempts ?? 0), Number(incoming.attempts ?? 0));
    existing.successes = Math.max(Number(existing.successes ?? 0), Number(incoming.successes ?? 0));
    existing.failures = Math.max(Number(existing.failures ?? 0), Number(incoming.failures ?? 0));
    existing.externalBlocks = Math.max(Number(existing.externalBlocks ?? 0), Number(incoming.externalBlocks ?? 0));
    existing.reversions = Math.max(Number(existing.reversions ?? 0), Number(incoming.reversions ?? 0));
    existing.revertFailures = Math.max(Number(existing.revertFailures ?? 0), Number(incoming.revertFailures ?? 0));
    existing.revertedRules = [...new Set([...(existing.revertedRules ?? []), ...(incoming.revertedRules ?? [])])];
    existing.revertedCommits = [...new Set([...(existing.revertedCommits ?? []), ...(incoming.revertedCommits ?? [])])];
  }
  merged.cases = [...caseMap.values()].map((item) => {
    const normalized = normalizeCaseCounters(item);
    normalized.confidence = normalized.attempts ? Number((normalized.successes / normalized.attempts).toFixed(4)) : 0;
    return normalized;
  });

  const playbookMap = new Map(merged.playbooks.map((item) => [`${item.rootCause}|${item.rule}`, item]));
  for (const incoming of derived.playbooks) {
    const key = `${incoming.rootCause}|${incoming.rule}`;
    const existing = playbookMap.get(key);
    if (!existing) {
      playbookMap.set(key, incoming);
      continue;
    }
    existing.attempts = Math.max(Number(existing.attempts ?? 0), Number(incoming.attempts ?? 0));
    existing.successes = Math.max(Number(existing.successes ?? 0), Number(incoming.successes ?? 0));
    existing.failures = Math.max(Number(existing.failures ?? 0), Number(incoming.failures ?? 0));
    existing.fingerprints = mergeUnique(existing.fingerprints, incoming.fingerprints, String);
    existing.successfulFingerprints = mergeUnique(existing.successfulFingerprints, incoming.successfulFingerprints, String);
    existing.failedFingerprints = mergeUnique(existing.failedFingerprints, incoming.failedFingerprints, String);
  }
  merged.playbooks = [...playbookMap.values()].map((item) => ({
    ...item,
    successRate: item.attempts ? Number((item.successes / item.attempts).toFixed(4)) : 0,
    generalized: new Set(item.successfulFingerprints ?? []).size >= 2 && item.successes >= 2 && (item.attempts ? item.successes / item.attempts : 0) >= 0.8,
  }));

  const actionMap = new Map((merged.actionHistory ?? []).map((item) => [item.fingerprint, item]));
  for (const incoming of derived.actionHistory ?? []) {
    const existing = actionMap.get(incoming.fingerprint);
    if (!existing) {
      actionMap.set(incoming.fingerprint, incoming);
      continue;
    }
    existing.occurrences = Math.max(Number(existing.occurrences ?? 0), Number(incoming.occurrences ?? 0));
    existing.successes = Math.max(Number(existing.successes ?? 0), Number(incoming.successes ?? 0));
    existing.failures = Math.max(Number(existing.failures ?? 0), Number(incoming.failures ?? 0));
    existing.features = [...new Set([...(existing.features ?? []), ...(incoming.features ?? [])])];
    existing.workflows = [...new Set([...(existing.workflows ?? []), ...(incoming.workflows ?? [])])].slice(-20);
    existing.evidence = [...(existing.evidence ?? []), ...(incoming.evidence ?? [])].slice(-12);
    existing.lastSeenAt = [existing.lastSeenAt, incoming.lastSeenAt].filter(Boolean).sort().at(-1) ?? existing.lastSeenAt ?? null;
  }
  merged.actionHistory = [...actionMap.values()].slice(-200);

  for (const collection of ['lessons', 'antiLessons']) {
    const map = new Map(merged[collection].map((item) => [item.id, item]));
    for (const incoming of derived[collection]) {
      const existing = map.get(incoming.id);
      if (!existing) {
        map.set(incoming.id, incoming);
        continue;
      }
      existing.attempts = Math.max(Number(existing.attempts ?? 0), Number(incoming.attempts ?? 0));
      existing.successes = Math.max(Number(existing.successes ?? 0), Number(incoming.successes ?? 0));
      existing.failures = Math.max(Number(existing.failures ?? 0), Number(incoming.failures ?? 0));
      existing.evidence = mergeUnique(existing.evidence, incoming.evidence, (item) => JSON.stringify(item)).slice(-8);
      existing.preventionRules = mergeUnique(existing.preventionRules, incoming.preventionRules, String).slice(-8);
      existing.lastSeenAt = [existing.lastSeenAt, incoming.lastSeenAt].filter(Boolean).sort().at(-1) ?? null;
    }
    merged[collection] = [...map.values()].map((item) => ({
      ...item,
      confidence: item.attempts ? Number((item.successes / item.attempts).toFixed(4)) : 0,
    }));
  }

  return normalizeMemoryCounters(merged);
}

function findCase(memory, fingerprint) {
  return memory.cases.find((item) => item.fingerprint === fingerprint);
}

function tokens(value = '') {
  return new Set(normalizeFailure(value).toLowerCase().split(/[^a-z0-9_<>-]+/).filter((item) => item.length >= 3));
}

function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / new Set([...left, ...right]).size;
}

export function findSimilarCases(memory, { fingerprint, normalized, features = [] } = {}) {
  const featureSet = new Set(features);
  return memory.cases
    .filter((item) => item.fingerprint !== fingerprint && (item.normalizedFailure || item.features?.length))
    .map((item) => {
      const textScore = similarity(normalized, item.normalizedFailure ?? '');
      const sharedFeatures = (item.features ?? []).filter((feature) => featureSet.has(feature)).length;
      const featureScore = Math.min(1, sharedFeatures / Math.max(1, new Set([...features, ...(item.features ?? [])]).size));
      const successScore = item.attempts ? item.successes / item.attempts : 0;
      const score = textScore * 0.55 + featureScore * 0.25 + successScore * 0.20;
      return { case: item, score: Number(score.toFixed(4)) };
    })
    .filter((item) => item.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function rankLessons(memory, { fingerprint, rootCause, rule } = {}) {
  const all = [...memory.lessons, ...memory.antiLessons.map((item) => ({ ...item, anti: true }))];
  return all
    .filter((item) => (!rootCause || item.rootCause === rootCause) && (!rule || item.rule === rule) || item.fingerprint === fingerprint)
    .map((item) => ({ ...item, score: Number(((item.confidence ?? 0) * (item.anti ? -1 : 1)).toFixed(4)) }))
    .sort((a, b) => b.score - a.score);
}

export function deriveReusableKnowledge(memory, { rootCause, features = [], fingerprint } = {}) {
  const aggregate = new Map();
  const caseBackedKeys = new Set();

  const ensure = (rc, rule) => {
    const key = `${rc}|${rule}`;
    const item = aggregate.get(key) ?? {
      rootCause: rc,
      rule,
      attempts: 0,
      successes: 0,
      failures: 0,
      fingerprints: new Set(),
      successfulFingerprints: new Set(),
      failedFingerprints: new Set(),
      revertedFingerprints: new Set(),
    };
    aggregate.set(key, item);
    return item;
  };

  for (const entry of memory.cases ?? []) {
    for (const outcome of entry.outcomes ?? []) {
      if (!outcome?.rule) continue;
      const item = ensure(entry.rootCause ?? 'unknown', outcome.rule);
      const key = `${item.rootCause}|${item.rule}`;
      caseBackedKeys.add(key);
      item.fingerprints.add(entry.fingerprint);
      if (outcome.outcome === 'success') {
        item.attempts += 1;
        item.successes += 1;
        item.successfulFingerprints.add(entry.fingerprint);
      } else if (['failure', 'blocked', 'unrepaired'].includes(outcome.outcome)) {
        item.attempts += 1;
        item.failures += 1;
        item.failedFingerprints.add(entry.fingerprint);
      }
    }
    for (const rule of entry.revertedRules ?? []) {
      const item = ensure(entry.rootCause ?? 'unknown', rule);
      item.revertedFingerprints.add(entry.fingerprint);
    }
  }

  for (const playbook of memory.playbooks ?? []) {
    const item = ensure(playbook.rootCause, playbook.rule);
    const key = `${item.rootCause}|${item.rule}`;
    for (const value of playbook.fingerprints ?? []) item.fingerprints.add(value);
    for (const value of playbook.successfulFingerprints ?? []) item.successfulFingerprints.add(value);
    for (const value of playbook.failedFingerprints ?? []) item.failedFingerprints.add(value);
    if (!caseBackedKeys.has(key)) {
      item.attempts += Number(playbook.attempts ?? 0);
      item.successes += Number(playbook.successes ?? 0);
      item.failures += Number(playbook.failures ?? 0);
    }
  }

  const relevantPlaybooks = [...aggregate.values()]
    .filter((item) => !rootCause || item.rootCause === rootCause)
    .map((item) => {
      const attempts = Number(item.attempts ?? 0);
      const successes = Number(item.successes ?? 0);
      const successRate = attempts ? successes / attempts : 0;
      const fingerprintSupport = item.fingerprints.size;
      const successfulFingerprintSupport = item.successfulFingerprints.size;
      const generalized = successfulFingerprintSupport >= 2 && successes >= 2 && successRate >= 0.8;
      return {
        rootCause: item.rootCause,
        rule: item.rule,
        attempts,
        successes,
        failures: Number(item.failures ?? 0),
        successRate: Number(successRate.toFixed(4)),
        fingerprintSupport,
        successfulFingerprintSupport,
        failedFingerprintSupport: item.failedFingerprints.size,
        revertedFingerprintSupport: item.revertedFingerprints.size,
        generalized,
      };
    });

  const blockedRules = new Set(
    (memory.cases ?? [])
      .filter((item) => !rootCause || item.rootCause === rootCause)
      .flatMap((item) => item.revertedRules ?? [])
      .filter(Boolean),
  );

  const generalizedRules = relevantPlaybooks
    .filter((item) => item.generalized && !blockedRules.has(item.rule))
    .sort((a, b) => (b.successRate - a.successRate) || (b.successfulFingerprintSupport - a.successfulFingerprintSupport));

  const rejectedRules = relevantPlaybooks
    .filter((item) => blockedRules.has(item.rule) || (item.failures >= 2 && item.successRate <= 0.25))
    .map((item) => ({ ...item, reason: blockedRules.has(item.rule) ? 'historical-revert' : 'low-success-rate' }));

  const historicalAdvisories = loadHistoricalKnowledge()
    .filter((entry) => (!rootCause || entry.rootCause === rootCause) && (
      !features.length || entry.features?.some((feature) => features.includes(feature)) || !entry.features
    ))
    .map((entry) => ({
      id: entry.id,
      rootCause: entry.rootCause,
      rule: entry.rule,
      lesson: entry.lesson,
      evidence: entry.evidence,
      status: 'historical-advisory',
      activation: 'fresh-proof-required',
    }));

  return {
    schemaVersion: 3,
    fingerprint: fingerprint ?? null,
    rootCause: rootCause ?? null,
    features: [...new Set(features)],
    generalizedRules,
    rejectedRules,
    historicalAdvisories,
    policy: {
      promotionRequiresDistinctFingerprints: 2,
      promotionRequiresSuccessfulRepairs: 2,
      promotionRequiresSuccessRate: 0.8,
      rejectedRulesAreNonReusable: true,
      exactShaProofStillRequired: true,
    },
  };
}

export function scorePlaybook(memory, rootCause, rule) {
  const records = memory.playbooks.filter((item) => item.rootCause === rootCause && item.rule === rule);
  const attempts = records.reduce((sum, item) => sum + item.attempts, 0);
  const successes = records.reduce((sum, item) => sum + item.successes, 0);
  return attempts ? successes / attempts : 0;
}

function stableLessonId({ fingerprint, rootCause, rule }) {
  return createHash('sha256').update(`${fingerprint}|${rootCause}|${rule ?? 'none'}`).digest('hex').slice(0, 20);
}

function confidenceFor(entry) {
  const attempts = entry.attempts ?? 0;
  if (!attempts) return 0;
  return Number((entry.successes / attempts).toFixed(4));
}

function upsertLesson(memory, { fingerprint, rootCause, rule, outcome, verification, provenance, preventionRule }) {
  const id = stableLessonId({ fingerprint, rootCause, rule });
  const collection = outcome === 'success' ? memory.lessons : memory.antiLessons;
  const lesson = collection.find((item) => item.id === id) ?? {
    id, fingerprint, rootCause, rule: rule ?? null, attempts: 0, successes: 0, failures: 0, confidence: 0, evidence: [], preventionRules: [], lastSeenAt: null,
  };
  lesson.attempts += 1;
  if (outcome === 'success') lesson.successes += 1; else lesson.failures += 1;
  lesson.confidence = confidenceFor(lesson);
  lesson.lastSeenAt = new Date().toISOString();
  lesson.evidence = [...lesson.evidence, { verification, provenance }].slice(-8);
  if (preventionRule) lesson.preventionRules = [...new Set([...lesson.preventionRules, preventionRule])].slice(-8);
  if (!collection.includes(lesson)) collection.push(lesson);
}

export function recordOutcome(memory, { fingerprint, normalizedFailure, features = [], rootCause, rule, outcome, verification, provenance, preventionRule } = {}) {
  const entry = findCase(memory, fingerprint) ?? { fingerprint, rootCause: 'unknown', attempts: 0, successes: 0, failures: 0, externalBlocks: 0, reversions: 0, revertFailures: 0, revertedRules: [], revertedCommits: [], rules: [], outcomes: [] };
  entry.rootCause = rootCause ?? entry.rootCause ?? 'unknown';
  if (normalizedFailure) entry.normalizedFailure = normalizeFailure(normalizedFailure);
  if (features.length) entry.features = [...new Set(features)];
  const isExternalBlock = outcome === 'blocked-external';
  const isHistoricalRevert = outcome === 'reverted-repair';
  const effectiveProviderSignature = provenance?.providerSignature ?? (isExternalBlock ? externalProviderSignature(normalizedFailure) : null);
  const strategyId = String(process.env.FLIXO_REPAIR_STRATEGY_ID ?? provenance?.strategyId ?? '').trim() || null;
  const promptId = String(process.env.FLIXO_PROMPT_ID ?? provenance?.promptId ?? '').trim() || null;
  const promptVersion = String(process.env.FLIXO_PROMPT_VERSION ?? provenance?.promptVersion ?? '').trim() || null;
  const masterPromptId = String(process.env.FLIXO_MASTER_PROMPT_ID ?? provenance?.masterPromptId ?? '').trim() || null;
  const promptDecision = String(process.env.FLIXO_PROMPT_DECISION ?? provenance?.promptDecision ?? '').trim() || null;
  const effectiveProvenance = {
    ...(provenance ?? {}),
    ...(strategyId ? { strategyId } : {}),
    ...(effectiveProviderSignature ? { providerSignature: effectiveProviderSignature } : {}),
    ...(promptId ? { promptId } : {}),
    ...(promptVersion ? { promptVersion } : {}),
    ...(masterPromptId ? { masterPromptId } : {}),
    ...(promptDecision ? { promptDecision } : {}),
  };
  const isHistoricalRevertFailure = outcome === 'revert-failure';
  if (isExternalBlock) entry.externalBlocks = (entry.externalBlocks ?? 0) + 1;
  if (isHistoricalRevert) {
    entry.reversions = (entry.reversions ?? 0) + 1;
    if (rule) entry.revertedRules = [...new Set([...(entry.revertedRules ?? []), rule])];
    if (/^[a-f0-9]{40}$/u.test(String(provenance?.revertedCommit ?? ''))) entry.revertedCommits = [...new Set([...(entry.revertedCommits ?? []), provenance.revertedCommit])];
  }
  if (isHistoricalRevertFailure) entry.revertFailures = (entry.revertFailures ?? 0) + 1;
  const countsAsRepairAttempt = ['success', 'unrepaired', 'failure', 'blocked'].includes(outcome);
  if (countsAsRepairAttempt) {
    entry.attempts += 1;
    const persistedAttempts = priorRepairArtifactCount() + 1;
    if (persistedAttempts > entry.attempts) entry.attempts = persistedAttempts;
  }
  if (outcome === 'success') entry.successes += 1; else if (countsAsRepairAttempt) entry.failures += 1;
  entry.confidence = confidenceFor(entry);
  if (rule) entry.rules = [...new Set([...entry.rules, rule])];
  entry.outcomes.push({ outcome, verification, rule, provenance: effectiveProvenance, preventionRule, at: new Date().toISOString() });
  entry.outcomes = entry.outcomes.slice(-10);
  if (!memory.cases.includes(entry)) memory.cases.push(entry);
  const countsAsPlaybookAttempt = ['success', 'unrepaired', 'failure', 'blocked'].includes(outcome);
  if (rule && countsAsPlaybookAttempt) {
    const playbook = memory.playbooks.find((item) => item.rootCause === entry.rootCause && item.rule === rule) ?? { rootCause: entry.rootCause, rule, attempts: 0, successes: 0, failures: 0, fingerprints: [], successfulFingerprints: [], failedFingerprints: [] };
    playbook.attempts += 1;
    playbook.fingerprints = [...new Set([...(playbook.fingerprints ?? []), fingerprint])];
    if (outcome === 'success') {
      playbook.successes += 1;
      playbook.successfulFingerprints = [...new Set([...(playbook.successfulFingerprints ?? []), fingerprint])];
    } else {
      playbook.failures += 1;
      playbook.failedFingerprints = [...new Set([...(playbook.failedFingerprints ?? []), fingerprint])];
    }
    playbook.successRate = Number((playbook.successes / playbook.attempts).toFixed(4));
    playbook.generalized = new Set(playbook.successfulFingerprints ?? []).size >= 2 && playbook.successes >= 2 && playbook.successRate >= 0.8;
    if (!memory.playbooks.includes(playbook)) memory.playbooks.push(playbook);
  }
  if (outcome === 'success' || outcome === 'unrepaired' || outcome === 'failure' || outcome === 'blocked' || outcome === 'blocked-external') {
    upsertLesson(memory, { fingerprint, rootCause: entry.rootCause, rule, outcome, verification, provenance: effectiveProvenance, preventionRule });
  }
  if (entry.attempts >= INTRACTABLE_THRESHOLD && entry.successes === 0) {
    fs.writeFileSync('/tmp/flixo-intractable-state', 'true\n');
    const data = loadIntractable();
    const existing = data.cases.find((item) => item.fingerprint === entry.fingerprint);
    const record = existing ?? {
      fingerprint: entry.fingerprint,
      status: 'INTRACTABLE',
      rootCause: entry.rootCause,
      attemptsAtEscalation: entry.attempts,
      attempts: entry.attempts,
      successes: entry.successes,
      failures: entry.failures,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: null,
      evidence: [],
      rejectedApproaches: [],
      teachingRequest: {
        required: true,
        protocol: 'SUPERVISING-REPAIR-TEACHING-v1',
        state: 'AWAITING_SUPERVISING_AGENT',
        requiredResponse: ['newHypothesis', 'diagnosticChange', 'repairStrategy', 'verificationPlan', 'doNotRepeat', 'exitCriteria'],
      },
      exitCriteria: 'A new evidence-backed strategy produces verified-repair on the exact target SHA and passes canonical CI.',
    };
    record.rootCause = entry.rootCause;
    record.attempts = entry.attempts;
    record.successes = entry.successes;
    record.failures = entry.failures;
    record.lastSeenAt = new Date().toISOString();
    record.evidence = [...record.evidence, { at: record.lastSeenAt, verification, provenance, rule: rule ?? null }].slice(-20);
    if (rule) record.rejectedApproaches = [...new Set([...record.rejectedApproaches, rule])].slice(-20);
    if (!existing) data.cases.push(record);
    writeIntractable(data);
    if (!existing) publishIntractableRecord(record);
  }
  return memory;
}

function bestHistoricalMemory() {
  if (process.env.FLIXO_SKIP_GIT_MEMORY_HISTORY === 'true') return null;
  const result = spawnSync('git', ['log', '--all', '--format=%H', '--max-count=64', '--', 'diagnostics/auto-repair/memory.json'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) return null;
  let best = null;
  let bestCaseCount = -1;
  for (const commitSha of result.stdout.split(/\s+/).filter(Boolean)) {
    const snapshot = spawnSync('git', ['show', commitSha + ':diagnostics/auto-repair/memory.json'], {
      encoding: 'utf8',
      env: process.env,
    });
    if (snapshot.status !== 0) continue;
    try {
      const parsed = normalizeMemoryCounters(JSON.parse(snapshot.stdout));
      if (!Number.isInteger(parsed?.version) || !Array.isArray(parsed?.cases)) continue;
      if (parsed.cases.length > bestCaseCount) {
        best = parsed;
        bestCaseCount = parsed.cases.length;
      }
    } catch {
      // Ignore malformed historical snapshots; preserve the newest valid memory.
    }
  }
  return best;
}
export function writeMemory(memory) {
  // Failed/non-green cycles are derived evidence only. Persisting them to the execution
  // branch creates a mutation-only commit, which can trigger approval/action-required
  // loops without producing a source repair. Verified repairs remain persistable.
  const outcome = process.env.FLIXO_LEARNING_OUTCOME ?? '';
  const trustedSourcePath = process.env.FLIXO_TRUSTED_REPAIR_MEMORY;
  if (outcome !== 'success' && outcome !== 'reverted-repair' && trustedSourcePath && fs.existsSync(trustedSourcePath)) {
    fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
    fs.copyFileSync(trustedSourcePath, memoryPath);
    return;
  }
  fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  let normalized = normalizeMemoryCounters({ ...emptyMemory(), ...memory });
  const historical = bestHistoricalMemory();
  if (historical && historical.cases.length > normalized.cases.length) {
    normalized = mergeMemoryHistory(historical, normalized);
  }
  normalized.version = Number.isInteger(memory?.version) ? Math.max(memory.version, MEMORY_VERSION) : MEMORY_VERSION;
  for (const key of ['cases', 'playbooks', 'lessons', 'antiLessons', 'actionHistory']) if (!Array.isArray(normalized[key])) normalized[key] = [];
  fs.writeFileSync(memoryPath, `${JSON.stringify(normalized, null, 2)}\n`);
}

if (process.argv[1]?.endsWith('auto-repair-learning.mjs') && process.env.FLIXO_LEARNING_OUTCOME) {
  const memory = loadMemory();
  const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const rawOutcome = process.env.FLIXO_LEARNING_OUTCOME;
  const verification = process.env.FLIXO_VERIFICATION ?? 'unknown';
  const normalizedOutcome = normalizeLearningOutcome(rawOutcome, verification);
  recordOutcome(memory, { fingerprint: fingerprintFailure(log), normalizedFailure: log, features: extractFeatures(log), rootCause: process.env.FLIXO_ROOT_CAUSE ?? 'unknown', rule: process.env.FLIXO_REPAIR_RULE || undefined, outcome: normalizedOutcome, verification, provenance: { source: 'FLIXO Auto Repair', failedSha: process.env.FLIXO_FAILED_SHA ?? null, targetSha: process.env.FLIXO_TARGET_SHA ?? null, revertedCommit: process.env.FLIXO_REVERTED_COMMIT ?? null, runId: process.env.FLIXO_RUN_ID ?? null, rawOutcome } });
  writeMemory(memory);
}
