#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { verifyCanonicalRepairContext } from './ai-phase1.mjs';

export const PHASE3_AGENTS = Object.freeze([
  'FAILURE_CLUSTERING',
  'BAYESIAN_CONFIDENCE_CALIBRATION',
  'CONTEXTUAL_BANDIT',
  'PREDICTIVE_ANOMALY_DETECTION',
  'LEARNING_EVOLUTION',
]);

export const REPAIR_STRATEGIES = Object.freeze([
  'reproduce-exact','minimize-failure','diff-forensics','environment-audit','workflow-forensics',
  'observability-trace','historical-analogy','synthetic-reproduction','alternate-hypothesis','supervising-escalation',
]);

const PHASE1 = process.env.FLIXO_AI_PHASE1_PATH ?? '/tmp/flixo-ai-phase1.json';
const PHASE2 = process.env.FLIXO_AI_PHASE2_PATH ?? '/tmp/flixo-ai-phase2.json';
const STRATEGY = process.env.FLIXO_REPAIR_STRATEGY_PATH ?? '/tmp/flixo-repair-strategy.json';
const MEMORY = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
const OUT = process.env.FLIXO_AI_PHASE3_PATH ?? '/tmp/flixo-ai-phase3.json';

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function tokens(value) {
  return new Set(String(value ?? '').toLowerCase().split(/[^a-z0-9_<>-]+/u).filter((x) => x.length >= 3));
}

function jaccard(a, b) {
  const left = a instanceof Set ? a : new Set(a ?? []);
  const right = b instanceof Set ? b : new Set(b ?? []);
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / union.size;
}

function similarity(a, b) {
  if (a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint) return 1;
  if (a.rootCause && b.rootCause && a.rootCause !== b.rootCause) return 0;
  return Number((jaccard(tokens(a.normalizedFailure), tokens(b.normalizedFailure)) * 0.7 + jaccard(a.features, b.features) * 0.3).toFixed(4));
}

export function clusterFailures(memory = {}, current = {}) {
  const records = [
    { id: 'current:' + String(current.fingerprint ?? digest(current)), fingerprint: current.fingerprint ?? null, rootCause: current.rootCause ?? 'unknown', normalizedFailure: current.normalizedFailure ?? '', features: [...new Set(current.features ?? [])] },
    ...(memory.cases ?? []).map((x) => ({ id: 'history:' + String(x.fingerprint ?? digest(x)), fingerprint: x.fingerprint ?? null, rootCause: x.rootCause ?? 'unknown', normalizedFailure: x.normalizedFailure ?? '', features: [...new Set(x.features ?? [])] })),
  ];
  const parent = records.map((_, i) => i);
  const find = (i) => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== i) { const next = parent[i]; parent[i] = root; i = next; }
    return root;
  };
  const unite = (a, b) => { const left = find(a); const right = find(b); if (left !== right) parent[right] = left; };
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) if (similarity(records[i], records[j]) >= 0.58) unite(i, j);
  }
  const groups = new Map();
  for (let i = 0; i < records.length; i += 1) {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(records[i]);
    groups.set(root, group);
  }
  const clusters = [...groups.values()].map((members) => {
    const fingerprints = [...new Set(members.map((x) => x.fingerprint).filter(Boolean))].sort();
    return {
      clusterId: 'cluster-' + digest({ rootCauses: [...new Set(members.map((x) => x.rootCause))].sort(), fingerprints }).slice(0, 20),
      size: members.length,
      fingerprints,
      rootCauses: [...new Set(members.map((x) => x.rootCause))].sort(),
      featureUnion: [...new Set(members.flatMap((x) => x.features))].sort(),
      members: members.map((x) => x.id).sort(),
    };
  }).sort((a, b) => (b.size - a.size) || a.clusterId.localeCompare(b.clusterId));
  const currentId = records[0]?.id;
  const currentCluster = clusters.find((x) => x.members.includes(currentId)) ?? null;
  return Object.freeze({
    schemaVersion: 1,
    algorithm: 'DETERMINISTIC_CONNECTED_COMPONENT_JACCARD',
    threshold: 0.58,
    currentClusterId: currentCluster?.clusterId ?? null,
    currentClusterSize: currentCluster?.size ?? 0,
    relatedFingerprints: currentCluster?.fingerprints ?? [],
    clusters,
  });
}

export function calibrateBayesianConfidence({ successes = 0, failures = 0, externalBlocks = 0, priorAlpha = 1, priorBeta = 1 } = {}) {
  const successCount = Math.max(0, Number(successes) || 0);
  const failureCount = Math.max(0, Number(failures) || 0);
  const alpha = (Number(priorAlpha) || 1) + successCount;
  const beta = (Number(priorBeta) || 1) + failureCount;
  const attempts = successCount + failureCount;
  return Object.freeze({
    schemaVersion: 1,
    model: 'BETA_BINOMIAL',
    prior: { alpha: Number(priorAlpha) || 1, beta: Number(priorBeta) || 1 },
    posterior: { alpha: Number(alpha.toFixed(6)), beta: Number(beta.toFixed(6)) },
    successes: successCount,
    failures: failureCount,
    attempts,
    externalBlocks: Math.max(0, Number(externalBlocks) || 0),
    posteriorMean: Number((alpha / (alpha + beta)).toFixed(6)),
    evidenceWeight: Number(Math.min(1, attempts / 5).toFixed(4)),
    externalBlocksExcluded: true,
  });
}

function strategyStats(memory, context) {
  return REPAIR_STRATEGIES.map((strategyId, order) => {
    let successes = 0;
    let failures = 0;
    let externalBlocks = 0;
    let observations = 0;
    let contextHits = 0;
    for (const entry of memory.cases ?? []) {
      const featureSet = new Set(entry.features ?? []);
      for (const outcome of entry.outcomes ?? []) {
        if (outcome?.provenance?.strategyId !== strategyId) continue;
        if (outcome.outcome === 'blocked-external') { externalBlocks += 1; continue; }
        if (!['success', 'failure', 'unrepaired', 'blocked', 'reverted-repair'].includes(outcome.outcome)) continue;
        observations += 1;
        if (outcome.outcome === 'success') successes += 1; else failures += 1;
        if (context.rootCause && entry.rootCause === context.rootCause) contextHits += 1;
        if ((context.features ?? []).some((feature) => featureSet.has(feature))) contextHits += 0.5;
      }
    }
    const confidence = calibrateBayesianConfidence({ successes, failures, externalBlocks });
    return { ...confidence, strategyId, order, observations, contextHits: Number(contextHits.toFixed(2)), contextRate: observations ? Number((contextHits / observations).toFixed(4)) : 0 };
  });
}

export function selectContextualBandit(memory = {}, context = {}, baselineStrategy = '') {
  const stats = strategyStats(memory, context);
  const rejected = new Set((context.rejectedStrategies ?? []).map(String));
  const availableStats = stats.filter((item) => !rejected.has(item.strategyId));
  if (!availableStats.length) return Object.freeze({ schemaVersion: 1, algorithm: 'BOUNDED_DETERMINISTIC_UCB_BETA', advisoryOnly: true, mayMutateRepository: false, blocked: true, reason: 'NO_UNUSED_REPAIR_STRATEGY', rejectedStrategies: [...rejected], topCandidates: [], recommendation: null });
  const totalObservations = availableStats.reduce((sum, item) => sum + item.observations, 0);
  const candidates = availableStats.map((item) => {
    const exploration = 0.35 * Math.sqrt(Math.log(totalObservations + 2) / (item.observations + 1));
    const contextBonus = 0.15 * item.contextRate;
    return { ...item, exploration: Number(exploration.toFixed(6)), contextBonus: Number(contextBonus.toFixed(6)), score: Number((item.posteriorMean + exploration + contextBonus).toFixed(6)) };
  }).sort((a, b) => (b.score - a.score) || (a.order - b.order));
  const baseline = availableStats.find((item) => item.strategyId === baselineStrategy) ?? null;
  const recommendation = totalObservations > 0 ? candidates[0] : (baseline ?? stats[0]);
  return Object.freeze({
    schemaVersion: 1,
    algorithm: 'BOUNDED_DETERMINISTIC_UCB_BETA',
    explorationCoefficient: 0.35,
    contextCoefficient: 0.15,
    totalObservations,
    rejectedStrategies: [...rejected],
    topCandidates: candidates.slice(0, 3),
    baselineStrategy: baselineStrategy || null,
    recommendation: recommendation ? { strategyId: recommendation.strategyId, score: recommendation.score, posteriorMean: recommendation.posteriorMean } : null,
    selectionMode: totalObservations > 0 ? 'LEARNED_UCB' : 'BASELINE_CONTROLLER_FALLBACK',
    advisoryOnly: true,
    mayMutateRepository: false,
    randomExploration: false,
    maxExplorationCandidates: 3,
  });
}

export function detectPredictiveAnomaly(memory = {}, cluster = {}, context = {}) {
  const same = (memory.cases ?? []).find((x) => x.fingerprint === context.fingerprint);
  const attempts = Number(same?.attempts ?? 0);
  const failures = Number(same?.failures ?? 0);
  const recurrencePressure = Math.min(1, attempts / 3);
  const clusterPressure = Math.min(1, Math.max(0, (Number(cluster.currentClusterSize) || 0) - 1) / 4);
  const unresolvedPressure = attempts ? Math.min(1, failures / Math.max(1, attempts)) : 0;
  const score = Number((recurrencePressure * 0.45 + clusterPressure * 0.3 + unresolvedPressure * 0.25).toFixed(4));
  return Object.freeze({
    schemaVersion: 1,
    algorithm: 'BOUNDED_RECURRENCE_PRESSURE',
    score,
    status: score >= 0.7 ? 'ANOMALOUS' : score >= 0.4 ? 'WATCH' : 'NORMAL',
    features: { recurrencePressure, clusterPressure, unresolvedPressure },
    sameFingerprint: { fingerprint: context.fingerprint ?? null, attempts, failures, successes: Number(same?.successes ?? 0) },
    predictionAuthority: 'SIGNAL_ONLY',
    mayBlockRelease: false,
    mayMutateRepository: false,
  });
}

export function deriveEvolutionProposals(memory = {}) {
  const blocked = new Set((memory.cases ?? []).flatMap((x) => x.revertedRules ?? []).filter(Boolean));
  const proposals = [];
  for (const playbook of memory.playbooks ?? []) {
    const fingerprints = [...new Set(playbook.successfulFingerprints ?? [])];
    const attempts = Number(playbook.attempts ?? 0);
    const successes = Number(playbook.successes ?? 0);
    const successRate = attempts ? successes / attempts : 0;
    if (blocked.has(playbook.rule) || fingerprints.length < 2 || successes < 2 || successRate < 0.8) continue;
    proposals.push({
      rootCause: playbook.rootCause,
      rule: playbook.rule,
      attempts,
      successes,
      successRate: Number(successRate.toFixed(4)),
      distinctSuccessfulFingerprints: fingerprints.length,
      status: 'PROMOTION_CANDIDATE',
      autoActivation: false,
      requiresFreshExactShaProof: true,
      requiresCanonicalCI: true,
      provenance: 'VERIFIED_MEMORY_ONLY',
    });
  }
  return Object.freeze({ schemaVersion: 1, algorithm: 'EVIDENCE_GATED_PLAYBOOK_EVOLUTION', proposals, autoActivation: false, requiresHumanOrControllerPromotion: true, rollbackRequiredBeforeActivation: true });
}

export function buildPhase3Report({ mode, phase1Report = null, phase2Report = null, memory = {}, baselineStrategy = '' } = {}) {
  const context = phase1Report?.canonicalRepairContext ?? {};
  const contextCheck = verifyCanonicalRepairContext(context);
  const current = {
    fingerprint: context.failure?.fingerprint ?? null,
    rootCause: context.failure?.rootCause ?? null,
    normalizedFailure: context.failure?.normalizedFailure ?? '',
    features: context.failure?.features ?? [],
  };
  const same = (memory.cases ?? []).filter((x) => x.fingerprint === current.fingerprint);
  const confidence = calibrateBayesianConfidence({
    successes: same.reduce((sum, x) => sum + Number(x.successes ?? 0), 0),
    failures: same.reduce((sum, x) => sum + Number(x.failures ?? 0), 0),
    externalBlocks: same.reduce((sum, x) => sum + Number(x.externalBlocks ?? 0), 0),
  });
  const clustering = clusterFailures(memory, current);
  const bandit = selectContextualBandit(memory, current, baselineStrategy);
  const anomaly = detectPredictiveAnomaly(memory, clustering, current);
  const evolution = deriveEvolutionProposals(memory);
  const failures = contextCheck.ok ? [] : [contextCheck.reason];
  if (mode === 'PREFLIGHT' && phase1Report?.mode !== 'PREFLIGHT') failures.push('PHASE1_NOT_PREFLIGHT');
  if (mode === 'POSTFLIGHT' && phase1Report?.mode !== 'POSTFLIGHT') failures.push('PHASE1_NOT_POSTFLIGHT');
  if (mode === 'POSTFLIGHT' && phase2Report?.protocol !== 'FLIXO-AI-PHASE2') failures.push('PHASE2_REPORT_INVALID');
  if (mode === 'POSTFLIGHT' && phase2Report?.overallStatus !== 'PASS') failures.push('PHASE2_GUARD_NOT_PASS');
  if (mode === 'POSTFLIGHT' && phase2Report?.upstreamPhase1?.contextHash !== context.contextHash) failures.push('PHASE2_CONTEXT_HASH_DRIFT');
  return Object.freeze({
    schemaVersion: 1,
    protocol: 'FLIXO-AI-PHASE3',
    mode,
    generatedAt: new Date().toISOString(),
    agents: PHASE3_AGENTS,
    upstream: { phase1ContextHash: context.contextHash ?? null, phase1SourceSha: context.sourceSha ?? null, failureFingerprint: current.fingerprint },
    clustering,
    bayesianConfidence: confidence,
    contextualBandit: bandit,
    predictiveAnomaly: anomaly,
    learningEvolution: evolution,
    status: failures.length ? 'BLOCK' : 'PASS',
    failures,
    authority: 'ADVISORY_ONLY',
    mayMutateRepository: false,
    mayDeclareGreen: false,
  });
}

function run(mode) {
  const phase1 = readJson(PHASE1, null);
  const phase2 = readJson(PHASE2, null);
  const memory = readJson(MEMORY, { cases: [], playbooks: [], lessons: [], antiLessons: [] });
  const strategy = readJson(STRATEGY, {});
  const report = buildPhase3Report({ mode, phase1Report: phase1, phase2Report: phase2, memory, baselineStrategy: strategy.strategyId ?? '' });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  if (report.status !== 'PASS') process.exitCode = 1;
  console.log(JSON.stringify(report, null, 2));
}

function assertPostflight() {
  const phase1 = readJson(PHASE1, null);
  const phase2 = readJson(PHASE2, null);
  const phase3 = readJson(OUT, null);
  const context = phase1?.canonicalRepairContext ?? {};
  const check = verifyCanonicalRepairContext(context);
  if (!check.ok) throw new Error('AI_PHASE3_CONTEXT=' + check.reason);
  if (phase3?.protocol !== 'FLIXO-AI-PHASE3' || phase3?.mode !== 'POSTFLIGHT') throw new Error('AI_PHASE3_REPORT_INVALID');
  if (phase3?.status !== 'PASS') throw new Error('AI_PHASE3_NOT_PASS');
  if (phase3?.upstream?.phase1ContextHash !== context.contextHash) throw new Error('AI_PHASE3_PHASE1_CONTEXT_DRIFT');
  if (phase3?.upstream?.phase1ContextHash !== phase2?.upstreamPhase1?.contextHash) throw new Error('AI_PHASE3_PHASE2_CONTEXT_DRIFT');
  if (phase3?.authority !== 'ADVISORY_ONLY' || phase3?.mayMutateRepository !== false || phase3?.mayDeclareGreen !== false) throw new Error('AI_PHASE3_AUTHORITY_DRIFT');
  console.log('AI_PHASE3_POSTFLIGHT_ASSERT=PASS');
}

const mode = process.argv.includes('--preflight') ? 'PREFLIGHT' : process.argv.includes('--postflight') ? 'POSTFLIGHT' : process.argv.includes('--assert-post') ? 'ASSERT' : '';
if (mode === 'PREFLIGHT' || mode === 'POSTFLIGHT') run(mode);
else if (mode === 'ASSERT') assertPostflight();
else { console.error('Usage: --preflight|--postflight|--assert-post'); process.exit(2); }
