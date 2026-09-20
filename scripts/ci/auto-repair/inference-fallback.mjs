#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeFailure, extractFeatures } from './fingerprint.mjs';

const HIST_INDEX = 'docs/agents/historical-action-errors/index.json';
const HIST_DIR = 'docs/agents/historical-action-errors/records';

const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function tokens(value) {
  return new Set(normalizeFailure(value).toLowerCase().split(/[^a-z0-9_<>-]+/).filter((t) => t.length >= 3));
}

function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / new Set([...left, ...right]).size;
}

function historicalRecords() {
  const index = readJson(HIST_INDEX, null);
  if (!index) return [];
  const ids = new Set(Object.values(index.byNormalized ?? {}).flat().filter((id) => typeof id === 'string'));
  return [...ids].map((id) => readJson(path.join(HIST_DIR, id + '.json'), null)).filter(Boolean);
}

function candidateFromRootCause(rootCause, features) {
  if (rootCause === 'lint' && features.includes('lint')) {
    return {
      strategyId: 'eslint-unused',
      repairRule: 'eslint-unused',
      mutationCapable: true,
      targetMode: 'exact-file',
      rationale: 'Historical lint failures repeatedly recovered through minimal exact-file lint correction.',
    };
  }
  if (rootCause === 'format' && features.includes('format')) {
    return {
      strategyId: 'prettier-file',
      repairRule: 'prettier-file',
      mutationCapable: true,
      targetMode: 'exact-file',
      rationale: 'Historical formatting failures repeatedly recovered through minimal exact-file formatting correction.',
    };
  }
  return {
    strategyId: 'historical-analogy',
    repairRule: null,
    mutationCapable: false,
    targetMode: 'proposal-only',
    rationale: 'No historically validated mutation rule maps safely to the inferred failure class.',
  };
}

export function inferFailureResolution({
  log = '',
  memory = { cases: [], lessons: [], antiLessons: [], playbooks: [] },
  targetSha = null,
  diagnosis = null,
} = {}) {
  const normalized = normalizeFailure(log);
  const features = extractFeatures(log);
  const hist = historicalRecords();

  const similarHistorical = hist
    .map((record) => ({
      record,
      score: similarity(normalized, record.normalized ?? ''),
    }))
    .filter((item) => item.score >= 0.22)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const historicalClasses = new Map();
  for (const item of similarHistorical) {
    const key = String(item.record.errorClass ?? 'unknown');
    const current = historicalClasses.get(key) ?? { errorClass: key, support: 0, score: 0, recordIds: [] };
    current.support += 1;
    current.score += item.score;
    if (current.recordIds.length < 8) current.recordIds.push(item.record.id);
    historicalClasses.set(key, current);
  }

  const inferredClass = [...historicalClasses.values()]
    .sort((a, b) => (b.support - a.support) || (b.score - a.score) || a.errorClass.localeCompare(b.errorClass))[0] ?? null;

  const rootCause = diagnosis?.rootCause && diagnosis.rootCause !== 'UNKNOWN_RCA'
    ? diagnosis.rootCause
    : inferredClass?.errorClass ?? 'unknown';

  const playbooks = (memory.playbooks ?? []).map((item) => ({
    ...item,
    attempts: Number(item.attempts ?? 0),
    successes: Number(item.successes ?? 0),
    failures: Number(item.failures ?? 0),
    successRate: Number(item.attempts ?? 0) ? Number(item.successes ?? 0) / Number(item.attempts ?? 0) : 0,
    successfulFingerprintSupport: new Set(item.successfulFingerprints ?? []).size,
  }));

  const compatible = playbooks
    .filter((item) => item.rootCause === rootCause)
    .map((item) => {
      const lesson = [...(memory.lessons ?? [])].find((x) => x.rule === item.rule && x.rootCause === rootCause);
      const anti = [...(memory.antiLessons ?? [])].find((x) => x.rule === item.rule && x.rootCause === rootCause);
      const featureSupport = features.some((feature) => String(item.rule).includes(feature)) ? 1 : 0;
      const support = Math.min(1, item.successfulFingerprintSupport / 4);
      const success = Math.min(1, item.successRate);
      const antiPenalty = anti ? Math.min(0.5, Number(anti.confidence ?? 0.5)) : 0;
      const score = Math.max(0, Number((support * 0.30 + success * 0.40 + featureSupport * 0.10 + Math.min(0.2, Number(lesson?.confidence ?? 0))).toFixed(4)) - antiPenalty);
      return { item, lesson, anti, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = compatible[0] ?? null;
  const candidate = candidateFromRootCause(rootCause, features);

  const evidenceDiversity = [
    similarHistorical.length > 0,
    Boolean(best),
    Boolean(diagnosis?.directFailureSignal),
    Boolean(diagnosis?.location?.file),
    Number(best?.item?.successfulFingerprintSupport ?? 0) >= 2,
  ].filter(Boolean).length;

  const novelty = Boolean(best && candidate.strategyId === best.item.rule)
    ? 'KNOWN_STRATEGY_TRANSFER'
    : Boolean(best)
      ? 'CROSS_CASE_SYNTHESIS'
      : 'NEW_HYPOTHESIS';

  const confidence = Number(Math.min(
    0.94,
    0.25 +
    Math.min(0.25, similarHistorical[0]?.score ?? 0) +
    Math.min(0.20, (best?.item?.successRate ?? 0) * 0.20) +
    Math.min(0.20, Number(best?.item?.successfulFingerprintSupport ?? 0) * 0.04) +
    Math.min(0.10, evidenceDiversity * 0.02)
  ).toFixed(3));

  const antiRejected = Boolean(best?.anti && Number(best.anti.confidence ?? 0) >= 0.5);
  const mutationEligible = Boolean(
    targetSha &&
    candidate.mutationCapable &&
    !antiRejected &&
    Number(best?.item?.successes ?? 0) >= 2 &&
    Number(best?.item?.successfulFingerprintSupport ?? 0) >= 2 &&
    Number(best?.item?.successRate ?? 0) >= 0.8 &&
    confidence >= 0.78 &&
    evidenceDiversity >= 3
  );

  const falsification = [
    'Reproduce the current failure on the exact target SHA.',
    'Show the inferred rule changes only the minimal affected surface.',
    'Run the targeted regression that originally failed twice.',
    'Run the affected contract verification after the inferred repair.',
    'Reject and record the strategy if the same fingerprint remains or a new regression appears.',
  ];

  return Object.freeze({
    schemaVersion: 1,
    authority: 'DETERMINISTIC_INFERENCE_FALLBACK',
    mode: diagnosis?.decision === 'ALLOW_BOUNDED_MUTATION' ? 'SUPPLEMENTAL' : 'FALLBACK',
    targetSha: targetSha ?? null,
    inputFingerprint: sha256(normalized),
    normalizedFailure: normalized,
    currentFeatures: [...new Set(features)],
    inferredClass: inferredClass
      ? { errorClass: inferredClass.errorClass, support: inferredClass.support, score: Number(inferredClass.score.toFixed(4)), recordIds: inferredClass.recordIds }
      : null,
    nearestHistoricalCases: similarHistorical.map(({ record, score }) => ({
      id: record.id,
      score: Number(score.toFixed(4)),
      errorClass: record.errorClass,
      workflow: record.workflow,
      job: record.job,
      sha: record.shas?.[0] ?? null,
    })),
    transferredPlaybook: best ? {
      rule: best.item.rule,
      rootCause: best.item.rootCause,
      attempts: best.item.attempts,
      successes: best.item.successes,
      successRate: Number(best.item.successRate.toFixed(4)),
      successfulFingerprintSupport: best.item.successfulFingerprintSupport,
      score: best.score,
      antiLesson: antiRejected,
    } : null,
    hypothesis: {
      rootCause,
      strategyId: candidate.strategyId,
      repairRule: candidate.repairRule,
      mutationCapable: candidate.mutationCapable,
      targetMode: candidate.targetMode,
      rationale: candidate.rationale,
      novelty,
    },
    prediction: {
      predictedOutcome: candidate.mutationCapable ? 'TARGETED_REPAIR_MAY_RECOVER_CURRENT_FAILURE' : 'MORE_EVIDENCE_REQUIRED',
      confidence,
      evidenceDiversity,
      thresholdForMutation: 0.78,
      eligibleForBoundedMutation: mutationEligible,
    },
    falsification,
    safety: {
      currentExactShaRequired: true,
      canonicalCiRequired: true,
      memoryIsPriorNotProof: true,
      externalToolingNeverGetsSourceMutation: rootCause === 'external-tooling',
      failClosed: !mutationEligible,
    },
    generatedAt: new Date().toISOString(),
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const log = fs.existsSync(process.env.FLIXO_FAILURE_LOG ?? '') ? fs.readFileSync(process.env.FLIXO_FAILURE_LOG, 'utf8') : '';
  const memory = readJson(process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json', { cases: [], lessons: [], antiLessons: [], playbooks: [] });
  const targetSha = process.env.FLIXO_TARGET_SHA ?? null;
  console.log(JSON.stringify(inferFailureResolution({ log, memory, targetSha }), null, 2));
}
