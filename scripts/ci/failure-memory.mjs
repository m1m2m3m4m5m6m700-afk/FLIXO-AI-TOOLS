#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIAG_DIR = resolve(ROOT, 'diagnostics/ci');
const MEMORY_PATH = resolve(DIAG_DIR, 'failure-memory.json');
const CLUSTERS_PATH = resolve(DIAG_DIR, 'failure-clusters.json');
const GRAPH_PATH = resolve(DIAG_DIR, 'root-cause-graph.json');
const HISTORY_PATH = resolve(DIAG_DIR, 'repair-history.jsonl');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const iso = () => new Date().toISOString();
const asSet = (items = []) => new Set(items.filter(Boolean));
const cap = (items, limit = 200) => [...new Set(items)].slice(-limit);

function emptyMemory() {
  return {
    schemaVersion: 1,
    schema: 'flixo-failure-memory/v1',
    updatedAt: null,
    cycles: 0,
    rootCauses: {},
    symptoms: {},
    clusters: {},
    repairs: [],
  };
}

function loadMemory() {
  if (!existsSync(MEMORY_PATH)) return emptyMemory();
  try {
    const value = JSON.parse(readFileSync(MEMORY_PATH, 'utf8'));
    if (!value || value.schema !== 'flixo-failure-memory/v1') return emptyMemory();
    return value;
  } catch {
    return emptyMemory();
  }
}

function rootFromRegistry(id, registry) {
  const known = registry[id] ?? {};
  return {
    domain: known.category ?? 'UNKNOWN',
    description: known.description ?? 'Unknown root cause.',
    repairTargets: known.repairTargets ?? [],
    verification: known.verification ?? [],
  };
}

function similarity(a, b) {
  const fields = [
    ['gate', 0.10],
    ['label', 0.15],
    ['rootCauseId', 0.25],
    ['category', 0.10],
    ['normalized', 0.20],
    ['dependencyContext', 0.10],
    ['fileCluster', 0.10],
  ];
  let score = 0;
  for (const [field, weight] of fields) {
    if (a[field] && b[field] && a[field] === b[field]) score += weight;
  }
  return Number(score.toFixed(2));
}

function stableSymptomKey(failure) {
  return sha256([
    failure.gate,
    failure.label,
    failure.rootCauseId ?? 'RC-UNKNOWN-001',
    failure.error?.category ?? 'UNKNOWN',
    failure.error?.normalized ?? '',
    failure.dependencyContext ?? '',
  ].join('\n')).slice(0, 16).toUpperCase();
}

function clusterKey(failures) {
  const dimensions = failures.map((failure) => ({
    rootCauseId: failure.rootCauseId ?? 'RC-UNKNOWN-001',
    category: failure.error?.category ?? 'UNKNOWN',
    gate: failure.gate,
    label: failure.label,
  }));
  return `CL-${sha256(JSON.stringify(dimensions.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))).slice(0, 12).toUpperCase()}`;
}

function inferRootCause(failure, memory, registry) {
  const declared = failure.rootCauseId;
  if (declared && declared !== 'RC-UNKNOWN-001' && registry[declared]) {
    return { rootCauseId: declared, confidence: 0.96, method: 'declared-check-contract' };
  }

  const candidates = Object.values(memory.symptoms)
    .map((symptom) => ({ symptom, score: similarity(symptom, {
      gate: failure.gate,
      label: failure.label,
      rootCauseId: declared,
      category: failure.error?.category,
      normalized: failure.error?.normalized,
      dependencyContext: failure.dependencyContext,
      fileCluster: failure.fileCluster,
    }) }))
    .filter((item) => item.score >= 0.55)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (best?.symptom.rootCauseId && best.score >= 0.75) {
    return { rootCauseId: best.symptom.rootCauseId, confidence: best.score, method: 'historical-symptom-match' };
  }

  const roots = Object.values(memory.rootCauses)
    .filter((root) => root.id !== 'RC-UNKNOWN-001')
    .map((root) => {
      let score = 0;
      if (root.affectedChecks?.some((item) => item.gate === failure.gate)) score += 0.20;
      if (root.affectedChecks?.some((item) => item.label === failure.label)) score += 0.30;
      if (root.category === failure.error?.category) score += 0.20;
      if (root.fingerprints?.includes(failure.fingerprint)) score += 0.30;
      return { root, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (roots?.score >= 0.75) return { rootCauseId: roots.root.id, confidence: roots.score, method: 'root-cause-history-match' };
  return { rootCauseId: declared ?? 'RC-UNKNOWN-001', confidence: declared ? 0.50 : 0.00, method: declared ? 'declared-unknown' : 'candidate-new-root' };
}

function correlate({ cycle, reports, registry }) {
  const memory = loadMemory();
  const failures = reports.flatMap((report) => (report.checks ?? [])
    .filter((check) => check.status === 'FAIL')
    .map((check) => ({ gate: report.gate, ...check })));
  const timestamp = cycle.recordedAt ?? iso();
  const inferred = failures.map((failure) => {
    const inference = inferRootCause(failure, memory, registry);
    const symptomId = stableSymptomKey(failure);
    return { ...failure, symptomId, inference };
  });

  const byRoot = new Map();
  for (const failure of inferred) {
    const id = failure.inference.rootCauseId;
    const list = byRoot.get(id) ?? [];
    list.push(failure);
    byRoot.set(id, list);
  }

  const rootSummaries = [];
  for (const [rootId, items] of byRoot) {
    const prior = memory.rootCauses[rootId];
    const meta = rootFromRegistry(rootId, registry);
    const priorStatus = prior?.status ?? 'DISCOVERED';
    const recurrence = Boolean(prior && prior.occurrences > 0);
    const regression = priorStatus === 'STABLE' || priorStatus === 'VERIFIED';
    const confidence = Math.max(...items.map((item) => item.inference.confidence), prior?.confidence ?? 0);
    const status = regression ? 'REGRESSION' : (priorStatus === 'REPAIRING' ? 'REPAIRING' : (confidence >= 0.75 ? 'CORRELATED' : 'DISCOVERED'));
    const root = {
      ...(prior ?? {}),
      id: rootId,
      category: meta.domain,
      domain: meta.domain.toLowerCase(),
      description: meta.description,
      repairTargets: meta.repairTargets,
      verification: meta.verification,
      status,
      confidence: Number(confidence.toFixed(2)),
      firstSeen: prior?.firstSeen ?? timestamp,
      lastSeen: timestamp,
      occurrences: (prior?.occurrences ?? 0) + items.length,
      recurrenceCount: (prior?.recurrenceCount ?? 0) + (recurrence ? items.length : 0),
      regressionCount: (prior?.regressionCount ?? 0) + (regression ? items.length : 0),
      fingerprints: cap([...(prior?.fingerprints ?? []), ...items.map((item) => item.fingerprint)]),
      affectedChecks: cap([...(prior?.affectedChecks ?? []), ...items.map((item) => ({ gate: item.gate, label: item.label }))]),
      affectedFiles: cap([...(prior?.affectedFiles ?? []), ...(items.flatMap((item) => item.files ?? []))]),
      symptoms: cap([...(prior?.symptoms ?? []), ...items.map((item) => item.symptomId)]),
      evidence: cap([...(prior?.evidence ?? []), ...items.map((item) => ({ cycleId: cycle.cycleId, sha: cycle.sha, gate: item.gate, label: item.label, fingerprint: item.fingerprint, confidence: item.inference.confidence }))]),
      lastInference: items[0]?.inference.method ?? 'unknown',
    };
    memory.rootCauses[rootId] = root;
    rootSummaries.push(root);
  }

  const symptomGroups = new Map();
  for (const failure of inferred) {
    const prior = memory.symptoms[failure.symptomId];
    memory.symptoms[failure.symptomId] = {
      ...(prior ?? {}),
      id: failure.symptomId,
      rootCauseId: failure.inference.rootCauseId,
      gate: failure.gate,
      label: failure.label,
      category: failure.error?.category ?? 'UNKNOWN',
      normalized: failure.error?.normalized ?? '',
      fingerprint: failure.fingerprint ?? null,
      firstSeen: prior?.firstSeen ?? timestamp,
      lastSeen: timestamp,
      occurrences: (prior?.occurrences ?? 0) + 1,
      shaHistory: cap([...(prior?.shaHistory ?? []), cycle.sha], 50),
      cycleHistory: cap([...(prior?.cycleHistory ?? []), cycle.cycleId], 50),
    };
    const group = symptomGroups.get(failure.inference.rootCauseId) ?? [];
    group.push(failure);
    symptomGroups.set(failure.inference.rootCauseId, group);
  }

  const clusters = [];
  for (const [rootId, items] of symptomGroups) {
    const id = clusterKey(items);
    const prior = memory.clusters[id];
    const cluster = {
      ...(prior ?? {}),
      id,
      rootCauseId: rootId,
      firstSeen: prior?.firstSeen ?? timestamp,
      lastSeen: timestamp,
      occurrences: (prior?.occurrences ?? 0) + items.length,
      distinctSymptoms: cap([...(prior?.distinctSymptoms ?? []), ...items.map((item) => item.symptomId)]),
      affectedChecks: cap([...(prior?.affectedChecks ?? []), ...items.map((item) => ({ gate: item.gate, label: item.label }))]),
      fingerprints: cap([...(prior?.fingerprints ?? []), ...items.map((item) => item.fingerprint)]),
      confidence: Number(Math.max(...items.map((item) => item.inference.confidence)).toFixed(2)),
      status: 'CORRELATED',
    };
    memory.clusters[id] = cluster;
    clusters.push(cluster);
  }

  const rootIds = new Set(Object.keys(memory.rootCauses));
  const edges = [];
  for (const rootId of rootIds) {
    const root = memory.rootCauses[rootId];
    for (const symptomId of root.symptoms ?? []) edges.push({ from: rootId, to: symptomId, type: 'CAUSES' });
    for (const check of root.affectedChecks ?? []) edges.push({ from: rootId, to: `${check.gate}:${check.label}`, type: 'AFFECTS_CHECK' });
  }

  memory.updatedAt = timestamp;
  memory.cycles += 1;
  memory.repairs = cap(memory.repairs, 1000);
  writeFileSync(MEMORY_PATH, `${JSON.stringify(memory, null, 2)}\n`);
  writeFileSync(CLUSTERS_PATH, `${JSON.stringify({ schema: 'flixo-failure-clusters/v1', generatedAt: timestamp, clusters }, null, 2)}\n`);
  writeFileSync(GRAPH_PATH, `${JSON.stringify({ schema: 'flixo-root-cause-graph/v1', generatedAt: timestamp, nodes: [...rootIds].map((id) => memory.rootCauses[id]), edges }, null, 2)}\n`);

  const repairRecord = {
    recordedAt: timestamp,
    cycleId: cycle.cycleId,
    sha: cycle.sha,
    roots: rootSummaries.map((root) => ({ id: root.id, status: root.status, confidence: root.confidence, occurrences: root.occurrences })),
    instruction: rootSummaries.length ? 'NO SYMPTOM PATCHING WHEN SHARED ROOT IS DETECTED' : 'NO ROOT CAUSE DETECTED',
  };
  const repairLine = `${JSON.stringify(repairRecord)}\n`;
  writeFileSync(HISTORY_PATH, existsSync(HISTORY_PATH) ? `${readFileSync(HISTORY_PATH, 'utf8')}${repairLine}` : repairLine);

  return {
    memory,
    roots: rootSummaries,
    clusters,
    distinctSymptoms: new Set(inferred.map((item) => item.symptomId)).size,
    recurrenceCount: rootSummaries.filter((root) => root.recurrenceCount > 0).length,
    regressionCount: rootSummaries.filter((root) => root.status === 'REGRESSION').length,
    newRootCount: rootSummaries.filter((root) => root.occurrences === 1).length,
    failures: inferred,
  };
}

export { correlate };
