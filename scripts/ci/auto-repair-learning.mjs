import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { normalizeFailure, fingerprintFailure, extractFeatures } from './auto-repair/fingerprint.mjs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
const intractablePath = process.env.FLIXO_INTRACTABLE_ERRORS ?? 'diagnostics/auto-repair/intractable-errors.json';
const INTRACTABLE_THRESHOLD = 10;
export { normalizeFailure, fingerprintFailure, extractFeatures };

const MEMORY_VERSION = 7;
const emptyMemory = () => ({ version: MEMORY_VERSION, cases: [], playbooks: [], lessons: [], antiLessons: [] });

export function loadMemory() {
  if (!fs.existsSync(memoryPath)) return emptyMemory();
  try {
    const parsed = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    return { ...emptyMemory(), ...parsed, version: MEMORY_VERSION };
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
  if (!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY) return;
  const run = (args) => spawnSync('gh', args, { encoding: 'utf8', env: process.env });
  const marker = `Auto Repair Intractable ${record.fingerprint.slice(0, 12)}`;
  const existing = run(['issue', 'list', '--repo', process.env.GITHUB_REPOSITORY, '--state', 'open', '--search', `\\"${marker}\\" in:title`, '--json', 'number']);
  if (existing.status !== 0) return;
  try {
    const issues = JSON.parse(existing.stdout || '[]');
    if (issues.length) return;
  } catch {
    return;
  }
  run(['issue', 'create', '--repo', process.env.GITHUB_REPOSITORY,
    '--title', marker,
    '--body', [
      `Protocol: SUPERVISING-REPAIR-TEACHING-v1`,
      `Fingerprint: ${record.fingerprint}`,
      `Attempts: ${record.attempts}`,
      `Root cause: ${record.rootCause}`,
      '',
      'This is diagnostic escalation only. It intentionally creates no branch and no repair lane.',
      'The repair cycle remains fail-closed until a new evidence-backed strategy is supplied and canonical CI verifies it.',
    ].join('\\n')
  ]);
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
  const entry = findCase(memory, fingerprint) ?? { fingerprint, rootCause: 'unknown', attempts: 0, successes: 0, failures: 0, rules: [], outcomes: [] };
  entry.rootCause = rootCause ?? entry.rootCause ?? 'unknown';
  if (normalizedFailure) entry.normalizedFailure = normalizeFailure(normalizedFailure);
  if (features.length) entry.features = [...new Set(features)];
  if (outcome !== 'proposed') {
    entry.attempts += 1;
    const persistedAttempts = priorRepairArtifactCount() + 1;
    if (persistedAttempts > entry.attempts) entry.attempts = persistedAttempts;
  }
  if (outcome === 'success') entry.successes += 1; else if (outcome !== 'proposed') entry.failures += 1;
  entry.confidence = confidenceFor(entry);
  if (rule) entry.rules = [...new Set([...entry.rules, rule])];
  entry.outcomes.push({ outcome, verification, rule, provenance, preventionRule, at: new Date().toISOString() });
  entry.outcomes = entry.outcomes.slice(-10);
  if (!memory.cases.includes(entry)) memory.cases.push(entry);
  if (rule && outcome !== 'proposed') {
    const playbook = memory.playbooks.find((item) => item.rootCause === entry.rootCause && item.rule === rule) ?? { rootCause: entry.rootCause, rule, attempts: 0, successes: 0, failures: 0 };
    playbook.attempts += 1;
    if (outcome === 'success') playbook.successes += 1; else playbook.failures += 1;
    playbook.successRate = Number((playbook.successes / playbook.attempts).toFixed(4));
    if (!memory.playbooks.includes(playbook)) memory.playbooks.push(playbook);
  }
  if (outcome === 'success' || outcome === 'unrepaired' || outcome === 'failure' || outcome === 'blocked') {
    upsertLesson(memory, { fingerprint, rootCause: entry.rootCause, rule, outcome, verification, provenance, preventionRule });
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

export function writeMemory(memory) {
  fs.mkdirSync(memoryPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  const normalized = { ...emptyMemory(), ...memory, version: MEMORY_VERSION };
  fs.writeFileSync(memoryPath, `${JSON.stringify(normalized, null, 2)}\n`);
}

if (process.argv[1]?.endsWith('auto-repair-learning.mjs') && process.env.FLIXO_LEARNING_OUTCOME) {
  const memory = loadMemory();
  const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  recordOutcome(memory, { fingerprint: fingerprintFailure(log), normalizedFailure: log, features: extractFeatures(log), rootCause: process.env.FLIXO_ROOT_CAUSE ?? 'unknown', rule: process.env.FLIXO_REPAIR_RULE || undefined, outcome: process.env.FLIXO_LEARNING_OUTCOME, verification: process.env.FLIXO_VERIFICATION ?? 'unknown', provenance: { source: 'FLIXO Auto Repair', failedSha: process.env.FLIXO_FAILED_SHA ?? null, runId: process.env.FLIXO_RUN_ID ?? null } });
  writeMemory(memory);
}
