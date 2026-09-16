import fs from 'node:fs';
import { normalizeFailure, fingerprintFailure, extractFeatures } from './auto-repair/fingerprint.mjs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
export { normalizeFailure, fingerprintFailure, extractFeatures };

export function loadMemory() {
  if (!fs.existsSync(memoryPath)) return { version: 6, cases: [], playbooks: [], metrics: defaultMetrics() };
  try { return { version: 6, cases: [], playbooks: [], metrics: defaultMetrics(), ...JSON.parse(fs.readFileSync(memoryPath, 'utf8')) }; }
  catch { return { version: 6, cases: [], playbooks: [], metrics: defaultMetrics() }; }
}

function defaultMetrics() {
  return { diagnosed: 0, attempts: 0, successes: 0, failures: 0, rollbacks: 0, recurrence: 0, totalAttempts: 0, updatedAt: null };
}

export function findCase(memory, fingerprint) {
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
  return memory.cases
    .filter((item) => item.fingerprint !== fingerprint && (item.normalizedFailure || item.features?.length))
    .map((item) => {
      const textScore = similarity(normalized, item.normalizedFailure ?? '');
      const featureSet = new Set(features);
      const sharedFeatures = (item.features ?? []).filter((feature) => featureSet.has(feature)).length;
      const featureScore = Math.min(1, sharedFeatures / Math.max(1, new Set([...features, ...(item.features ?? [])]).size));
      const success = item.successes + item.failures ? item.successes / (item.successes + item.failures) : 0;
      return { case: item, score: Number((textScore * 0.65 + featureScore * 0.2 + success * 0.15).toFixed(4)) };
    })
    .filter((item) => item.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function scorePlaybook(memory, rootCause, rule) {
  const records = memory.playbooks.filter((item) => item.rootCause === rootCause && item.rule === rule);
  const attempts = records.reduce((sum, item) => sum + item.attempts, 0);
  const successes = records.reduce((sum, item) => sum + item.successes, 0);
  return attempts ? successes / attempts : 0;
}

export function rankRules(memory, rootCause, rules = []) {
  return [...new Set(rules)].map((rule) => ({ rule, score: scorePlaybook(memory, rootCause, rule), attempts: memory.playbooks.find((p) => p.rootCause === rootCause && p.rule === rule)?.attempts ?? 0 }))
    .sort((a, b) => b.score - a.score || b.attempts - a.attempts);
}

export function recordOutcome(memory, { fingerprint, normalizedFailure, features = [], rootCause, rule, outcome, verification, provenance, preventionRule, risk } = {}) {
  memory.metrics ??= defaultMetrics();
  memory.metrics.diagnosed += 1;
  const entry = findCase(memory, fingerprint) ?? { fingerprint, rootCause: 'unknown', attempts: 0, successes: 0, failures: 0, rules: [], outcomes: [] };
  const isAttempt = outcome !== 'proposed';
  const wasKnown = Boolean(findCase(memory, fingerprint));
  entry.rootCause = rootCause ?? entry.rootCause ?? 'unknown';
  if (normalizedFailure) entry.normalizedFailure = normalizeFailure(normalizedFailure);
  if (features.length) entry.features = [...new Set(features)];
  if (isAttempt) { entry.attempts += 1; memory.metrics.attempts += 1; memory.metrics.totalAttempts += 1; }
  if (outcome === 'success') { entry.successes += 1; memory.metrics.successes += 1; }
  else if (isAttempt) { entry.failures += 1; memory.metrics.failures += 1; }
  if (wasKnown && isAttempt) memory.metrics.recurrence += 1;
  if (outcome === 'rolled-back' || verification === 'reproduction/regression-failed' || verification === 'exception') memory.metrics.rollbacks += 1;
  if (rule) entry.rules = [...new Set([...entry.rules, rule])];
  entry.outcomes.push({ outcome, verification, rule, risk: risk ?? 'unknown', provenance, preventionRule, at: new Date().toISOString() });
  entry.outcomes = entry.outcomes.slice(-10);
  if (!memory.cases.includes(entry)) memory.cases.push(entry);
  if (rule && isAttempt) {
    const playbook = memory.playbooks.find((item) => item.rootCause === entry.rootCause && item.rule === rule) ?? { rootCause: entry.rootCause, rule, attempts: 0, successes: 0, failures: 0 };
    playbook.attempts += 1;
    if (outcome === 'success') playbook.successes += 1; else playbook.failures += 1;
    playbook.successRate = Number((playbook.successes / playbook.attempts).toFixed(4));
    playbook.lastOutcome = outcome;
    playbook.updatedAt = new Date().toISOString();
    if (!memory.playbooks.includes(playbook)) memory.playbooks.push(playbook);
  }
  memory.metrics.updatedAt = new Date().toISOString();
  return memory;
}

export function writeMemory(memory) {
  fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);
}

if (process.argv[1]?.endsWith('auto-repair-learning.mjs') && process.env.FLIXO_LEARNING_OUTCOME) {
  const memory = loadMemory();
  const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  recordOutcome(memory, { fingerprint: fingerprintFailure(log), normalizedFailure: log, features: extractFeatures(log), rootCause: process.env.FLIXO_ROOT_CAUSE ?? 'unknown', rule: process.env.FLIXO_REPAIR_RULE || undefined, outcome: process.env.FLIXO_LEARNING_OUTCOME, verification: process.env.FLIXO_VERIFICATION ?? 'unknown', risk: process.env.FLIXO_RISK ?? 'unknown' });
  writeMemory(memory);
}
