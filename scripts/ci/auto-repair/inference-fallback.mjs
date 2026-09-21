#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeFailure, extractFeatures } from './fingerprint.mjs';
import { retrieveTeachingRecords } from '../error-learning-log.mjs';

const HIST_INDEX = 'docs/agents/historical-action-errors/index.json';
const HIST_DIR = 'docs/agents/historical-action-errors/records';
const HIST_KNOWLEDGE = 'docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json';

const SUPPORTED_ADAPTERS = Object.freeze({
  'eslint-unused': Object.freeze({
    rootCause: 'lint',
    targetMode: 'exact-file',
    mutationCapable: true,
    rationale: 'Validated deterministic lint correction on the exact reported source file.',
  }),
  'prettier-file': Object.freeze({
    rootCause: 'format',
    targetMode: 'exact-file',
    mutationCapable: true,
    rationale: 'Validated deterministic formatting correction on the exact reported source file.',
  }),
});

const TEACHING_CLASS_BY_ROOT_CAUSE = Object.freeze({
  lint: 'eslint',
  format: 'eslint',
  typescript: 'typescript',
  build: 'build-chunk',
  playwright: 'playwright-webkit',
  'webkit-render': 'playwright-webkit',
  certification: 'control-plane',
  'external-tooling': 'capi-model',
});

const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function tokens(value) {
  return new Set(
    normalizeFailure(value)
      .toLowerCase()
      .split(/[^a-z0-9_<>-]+/)
      .filter((token) => token.length >= 3),
  );
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
  return [...ids]
    .map((id) => readJson(path.join(HIST_DIR, id + '.json'), null))
    .filter(Boolean);
}

function historicalKnowledge() {
  const parsed = readJson(HIST_KNOWLEDGE, null);
  return Array.isArray(parsed?.entries) ? parsed.entries.filter((entry) => entry?.rootCause && entry?.rule) : [];
}

function safeTeachingRecords(rootCause) {
  const className = TEACHING_CLASS_BY_ROOT_CAUSE[rootCause];
  if (!className) return [];
  try {
    return retrieveTeachingRecords({ className, limit: 12 });
  } catch {
    return [];
  }
}

function normalizeCount(value) {
  return Math.max(0, Number(value ?? 0));
}

function compatiblePlaybooks(memory, rootCause, features) {
  return (memory.playbooks ?? [])
    .map((item) => {
      const attempts = normalizeCount(item.attempts);
      const successes = normalizeCount(item.successes);
      const failures = normalizeCount(item.failures);
      const successfulFingerprintSupport = new Set([
        ...(item.successfulFingerprints ?? []),
      ]).size;
      const successRate = attempts ? successes / attempts : 0;
      const lesson = [...(memory.lessons ?? [])]
        .find((entry) => entry.rule === item.rule && entry.rootCause === rootCause);
      const anti = [...(memory.antiLessons ?? [])]
        .find((entry) => entry.rule === item.rule && entry.rootCause === rootCause);
      const featureSupport = features.some((feature) => String(item.rule ?? '').includes(feature)) ? 1 : 0;
      const support = Math.min(1, successfulFingerprintSupport / 4);
      const success = Math.min(1, successRate);
      const lessonSupport = Math.min(0.2, normalizeCount(lesson?.confidence));
      const antiPenalty = anti ? Math.min(0.5, normalizeCount(anti.confidence || 0.5)) : 0;
      const score = Math.max(
        0,
        Number((
          support * 0.30 +
          success * 0.40 +
          featureSupport * 0.10 +
          lessonSupport
        ).toFixed(4)) - antiPenalty,
      );
      return {
        item: {
          ...item,
          attempts,
          successes,
          failures,
          successRate,
          successfulFingerprintSupport,
        },
        lesson,
        anti,
        score,
      };
    })
    .filter((entry) => entry.item.rootCause === rootCause)
    .sort((a, b) => b.score - a.score);
}

function teachingRuleCandidates(records, rootCause) {
  return records
    .map((record) => ({
      rule: record.rule ?? record.repairRule ?? record.strategyId ?? null,
      className: record.class ?? record.errorClass ?? null,
      lesson: record.lesson ?? null,
      id: record.id ?? null,
    }))
    .filter((entry) => entry.rule && (!entry.className || String(entry.className) === String(TEACHING_CLASS_BY_ROOT_CAUSE[rootCause] ?? entry.className)));
}

function knowledgeRuleCandidates(entries, rootCause) {
  return entries
    .filter((entry) => entry.rootCause === rootCause)
    .map((entry) => ({
      rule: entry.rule,
      id: entry.id,
      lesson: entry.lesson ?? null,
      evidence: entry.evidence ?? [],
    }));
}

function buildSynthesis({
  rootCause,
  features,
  bestPlaybook,
  teachingCandidates,
  knowledgeCandidates,
}) {
  const learnedRule = bestPlaybook?.item?.rule
    ?? teachingCandidates[0]?.rule
    ?? knowledgeCandidates[0]?.rule
    ?? null;
  const adapter = learnedRule ? SUPPORTED_ADAPTERS[learnedRule] : null;
  if (adapter) {
    const source = bestPlaybook?.item?.rule === learnedRule
      ? 'playbook'
      : teachingCandidates.some((item) => item.rule === learnedRule)
        ? 'teaching-corpus'
        : 'historical-knowledge';
    return {
      strategyId: learnedRule,
      repairRule: learnedRule,
      mutationCapable: true,
      targetMode: adapter.targetMode,
      rationale: adapter.rationale,
      source,
      mode: bestPlaybook?.item?.rule === learnedRule ? 'KNOWN_STRATEGY_TRANSFER' : 'CROSS_CASE_SYNTHESIS',
      ingredients: [
        rootCause,
        ...features,
        bestPlaybook ? 'validated-playbook' : null,
        teachingCandidates.length ? 'teaching-corpus' : null,
        knowledgeCandidates.length ? 'historical-knowledge' : null,
      ].filter(Boolean),
      steps: [
        'Bind the hypothesis to the exact current failure location and SHA.',
        'Reproduce the current failure before mutation.',
        'Apply only the supported deterministic adapter.',
        'Run targeted regression twice.',
        'Require downstream contract verification and Canonical CI.',
      ],
    };
  }

  const seed = [
    rootCause,
    ...features,
    bestPlaybook?.item?.rule ?? '',
    teachingCandidates[0]?.rule ?? '',
    knowledgeCandidates[0]?.rule ?? '',
  ].join('|');

  return {
    strategyId: 'synth-' + sha256(seed).slice(0, 16),
    repairRule: learnedRule,
    mutationCapable: false,
    targetMode: 'proposal-only',
    rationale: learnedRule
      ? 'Evidence supports a learned strategy shape, but no deterministic mutation adapter is approved for this rule.'
      : 'Evidence does not map to a validated mutation adapter; synthesize a bounded investigation hypothesis only.',
    source: bestPlaybook ? 'cross-case-learning' : teachingCandidates.length || knowledgeCandidates.length ? 'learned-advisories' : 'current-evidence',
    mode: bestPlaybook || teachingCandidates.length || knowledgeCandidates.length
      ? 'CROSS_CASE_SYNTHESIS'
      : 'NEW_HYPOTHESIS',
    ingredients: [
      rootCause,
      ...features,
      bestPlaybook ? 'validated-playbook' : null,
      teachingCandidates.length ? 'teaching-corpus' : null,
      knowledgeCandidates.length ? 'historical-knowledge' : null,
    ].filter(Boolean),
    steps: [
      'Collect fresh exact-SHA evidence for the failure surface.',
      'Compare causal mechanisms across the nearest historical cases.',
      'Generate a minimal candidate change as a proposal only.',
      'Falsify the hypothesis with targeted regression and protected contracts.',
      'Promote the strategy to mutation only after a supported deterministic adapter exists.',
    ],
  };
}

function historicalEvents(records, memory) {
  const events = [];
  for (const record of records) {
    const className = String(record.errorClass ?? 'unknown');
    const workflow = record.workflow ?? null;
    const runs = Array.isArray(record.runs) && record.runs.length ? record.runs : [record.id ?? null];
    for (const runId of runs) {
      events.push({
        runId: runId ? String(runId) : null,
        at: record.lastSeen ?? record.firstSeen ?? '',
        workflow,
        errorClass: className,
      });
    }
  }
  for (const item of memory.actionHistory ?? []) {
    for (const evidence of item.evidence ?? []) {
      events.push({
        runId: evidence.runId ? String(evidence.runId) : null,
        at: evidence.at ?? item.lastSeenAt ?? item.firstSeenAt ?? '',
        workflow: evidence.workflow ?? null,
        errorClass: item.rootCause ?? 'unknown',
      });
    }
  }
  return events;
}

function buildPredictions(records, memory, currentClasses) {
  const workflowFilter = process.env.GITHUB_WORKFLOW ? String(process.env.GITHUB_WORKFLOW) : null;
  const events = historicalEvents(records, memory)
    .filter((event) => !workflowFilter || event.workflow === workflowFilter)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const runState = new Map();
  for (const event of events) {
    const key = event.runId ?? 'anonymous:' + event.at;
    const existing = runState.get(key);
    if (!existing) {
      runState.set(key, event);
      continue;
    }
    if (String(event.at) >= String(existing.at)) {
      runState.set(key, event);
    }
  }

  const ordered = [...runState.values()].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const transitions = new Map();
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1].errorClass;
    const next = ordered[i].errorClass;
    if (!currentClasses.includes(previous) || previous === next) continue;
    const key = previous + '→' + next;
    transitions.set(key, Number(transitions.get(key) ?? 0) + 1);
  }

  return [...transitions.entries()]
    .map(([key, count]) => {
      const parts = key.split('→');
      return { from: parts[0], to: parts[1], count };
    })
    .sort((a, b) => b.count - a.count || a.to.localeCompare(b.to))
    .slice(0, 5);
}

export function inferFailureResolution({
  log = '',
  memory = { cases: [], lessons: [], antiLessons: [], playbooks: [], actionHistory: [] },
  targetSha = null,
  diagnosis = null,
  historicalRecordsOverride = null,
} = {}) {
  const normalized = normalizeFailure(log);
  const features = extractFeatures(log);
  const hist = Array.isArray(historicalRecordsOverride) ? historicalRecordsOverride : historicalRecords();
  const knowledge = historicalKnowledge();
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
    const current = historicalClasses.get(key) ?? {
      errorClass: key,
      support: 0,
      score: 0,
      recordIds: [],
    };
    current.support += 1;
    current.score += item.score;
    if (current.recordIds.length < 8) current.recordIds.push(item.record.id);
    historicalClasses.set(key, current);
  }

  const inferredClass = [...historicalClasses.values()]
    .sort((a, b) => (b.support - a.support) || (b.score - a.score) || a.errorClass.localeCompare(b.errorClass))[0] ?? null;

  const rootCause = diagnosis?.rootCause && diagnosis.rootCause !== 'UNKNOWN_RCA'
    ? String(diagnosis.rootCause)
    : inferredClass?.errorClass ?? 'unknown';

  const playbooks = compatiblePlaybooks(memory, rootCause, features);
  const best = playbooks[0] ?? null;
  const teachingRecords = safeTeachingRecords(rootCause);
  const teachingCandidates = teachingRuleCandidates(teachingRecords, rootCause);
  const knowledgeCandidates = knowledgeRuleCandidates(knowledge, rootCause);
  const synthesis = buildSynthesis({
    rootCause,
    features,
    bestPlaybook: best,
    teachingCandidates,
    knowledgeCandidates,
  });

  const evidenceDiversity = [
    similarHistorical.length > 0,
    Boolean(best),
    teachingCandidates.length > 0,
    knowledgeCandidates.length > 0,
    diagnosis?.directFailureSignal === true,
    Boolean(diagnosis?.location?.file),
  ].filter(Boolean).length;

  const novelty = synthesis.mode;
  const exactSha = /^[a-f0-9]{40}$/i.test(String(targetSha ?? ''));
  const antiRejected = Boolean(best?.anti && normalizeCount(best.anti.confidence || 0.5) >= 0.5);
  const confidence = Number(Math.min(
    0.94,
    0.20 +
    Math.min(0.25, similarHistorical[0]?.score ?? 0) +
    Math.min(0.20, best?.item?.successRate ?? 0) * 0.20 +
    Math.min(0.16, normalizeCount(best?.item?.successfulFingerprintSupport) * 0.04) +
    Math.min(0.12, evidenceDiversity * 0.02) +
    (teachingCandidates.length ? 0.04 : 0),
  ).toFixed(3));

  const directEvidence = diagnosis?.directFailureSignal === true;
  const locationVerified = !['lint', 'format'].includes(rootCause) || Boolean(diagnosis?.location?.file);
  const mutationEligible =
    exactSha &&
    synthesis.mutationCapable &&
    directEvidence &&
    locationVerified &&
    diagnosis?.ambiguity !== true &&
    !antiRejected &&
    normalizeCount(best?.item?.successes) >= 2 &&
    normalizeCount(best?.item?.successfulFingerprintSupport) >= 2 &&
    normalizeCount(best?.item?.successRate) >= 0.8 &&
    confidence >= 0.78 &&
    evidenceDiversity >= 3;

  const currentClasses = [...new Set([
    ...(similarHistorical.map(({ record }) => String(record.errorClass ?? 'unknown'))),
    rootCause,
  ])];

  const predictions = buildPredictions(hist, memory, currentClasses);

  const falsification = [
    'Reproduce the current failure on the exact target SHA.',
    'Show the inferred strategy changes only the minimal affected surface.',
    'Run the targeted regression that originally failed twice.',
    'Run the affected contract verification after the inferred repair.',
    'Reject and record the strategy if the same fingerprint remains or a new regression appears.',
  ];

  return Object.freeze({
    schemaVersion: 2,
    authority: 'DETERMINISTIC_INFERENCE_FALLBACK',
    mode: diagnosis?.decision === 'ALLOW_BOUNDED_MUTATION' && !mutationEligible ? 'SUPPLEMENTAL' : 'FALLBACK',
    targetSha: targetSha ?? null,
    inputFingerprint: sha256(normalized),
    normalizedFailure: normalized,
    currentFeatures: [...new Set(features)],
    inferredClass: inferredClass
      ? {
        errorClass: inferredClass.errorClass,
        support: inferredClass.support,
        score: Number(inferredClass.score.toFixed(4)),
        recordIds: inferredClass.recordIds,
      }
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
      failures: best.item.failures,
      successRate: Number(best.item.successRate.toFixed(4)),
      successfulFingerprintSupport: best.item.successfulFingerprintSupport,
      score: best.score,
      antiLesson: antiRejected,
    } : null,
    learningSources: {
      teachingClass: TEACHING_CLASS_BY_ROOT_CAUSE[rootCause] ?? null,
      teachingRecords: teachingCandidates.slice(0, 8).map((item) => ({
        id: item.id,
        rule: item.rule,
        className: item.className,
      })),
      historicalKnowledge: knowledgeCandidates.slice(0, 8).map((item) => ({
        id: item.id,
        rule: item.rule,
        evidenceCount: item.evidence.length,
      })),
    },
    hypothesis: {
      rootCause,
      strategyId: synthesis.strategyId,
      repairRule: synthesis.repairRule,
      mutationCapable: synthesis.mutationCapable,
      targetMode: synthesis.targetMode,
      rationale: synthesis.rationale,
      novelty,
      synthesis,
    },
    prediction: {
      predictedOutcome: synthesis.mutationCapable
        ? 'TARGETED_REPAIR_MAY_RECOVER_CURRENT_FAILURE'
        : 'MORE_EVIDENCE_REQUIRED',
      confidence,
      evidenceDiversity,
      thresholdForMutation: 0.78,
      eligibleForBoundedMutation: mutationEligible,
      nextFailureClasses: predictions,
      predictionBasis: predictions.length ? 'historical-run-transition' : 'none',
    },
    falsification,
    safety: {
      currentExactShaRequired: true,
      canonicalCiRequired: true,
      memoryIsPriorNotProof: true,
      externalToolingNeverGetsSourceMutation: rootCause === 'external-tooling',
      unsupportedSynthesizedStrategiesRemainProposalOnly: !SUPPORTED_ADAPTERS[synthesis.strategyId],
      failClosed: !mutationEligible,
    },
    generatedAt: new Date().toISOString(),
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const logPath = process.env.FLIXO_FAILURE_LOG ?? '';
  const log = logPath && fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const memory = readJson(process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json', {
    cases: [],
    lessons: [],
    antiLessons: [],
    playbooks: [],
    actionHistory: [],
  });
  const targetSha = process.env.FLIXO_TARGET_SHA ?? null;
  console.log(JSON.stringify(inferFailureResolution({ log, memory, targetSha }), null, 2));
}
