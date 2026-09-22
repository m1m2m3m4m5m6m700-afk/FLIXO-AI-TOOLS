import fs from 'node:fs';
import crypto from 'node:crypto';

const CORPUS = Object.freeze([
  'docs/agents/ERROR-TEACHING-500.md',
  'docs/agents/ERROR-TEACHING-ADDITIONAL-500.md',
  'docs/agents/ERROR-TEACHING-EXPANDED-A-1000.md',
  'docs/agents/ERROR-TEACHING-EXPANDED-B-1000.md',
  'docs/agents/ERROR-TEACHING-EXPANDED-C-1000.md',
  'docs/agents/ERROR-TEACHING-EXPANDED-D-1000.md',
]);
const EXPECTED_RECORDS = 5000;
const MAX_TEXT = 1200;
const TOKEN_RE = /[a-z0-9][a-z0-9:_-]{2,}/giu;
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'must', 'when', 'before',
  'after', 'then', 'only', 'into', 'from', 'case', 'error', 'failure', 'stage',
  'trigger', 'invariant', 'action', 'teaching', 'verify', 'record', 'exact',
]);

let cachedCorpus = null;

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tokens(value) {
  const result = [];
  for (const token of normalize(value).match(TOKEN_RE) ?? []) {
    if (!STOP_WORDS.has(token)) result.push(token);
  }
  return new Set(result);
}

function parseTeachingLine(line, fallbackId = 0) {
  const match = String(line).match(/^T(\d+)\s+\|\s*(.*)$/u);
  if (!match) return null;
  const id = Number(match[1]);
  const fields = {};
  for (const part of match[2].split(/\s+\|\s+/u)) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    fields[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  if (!fields.class || !fields.stage || !fields.invariant || !fields.action || !fields.verify) return null;
  const text = [fields.trigger, fields.invariant, fields.action, fields.teaching, fields.verify].filter(Boolean).join(' ');
  return Object.freeze({
    id: `T${String(id).padStart(4, '0')}`,
    number: id,
    className: fields.class,
    stage: fields.stage,
    trigger: fields.trigger ?? '',
    invariant: fields.invariant,
    action: fields.action,
    teaching: fields.teaching ?? '',
    verify: fields.verify,
    tokens: tokens(text),
    digest: crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16),
    sourceLine: fallbackId,
  });
}

function loadCorpus() {
  if (cachedCorpus) return cachedCorpus;
  const records = [];
  const byClass = new Map();
  const byStage = new Map();
  const byNumber = new Map();
  for (const file of CORPUS) {
    const content = fs.readFileSync(file, 'utf8');
    for (const line of content.split(/\r?\n/u)) {
      const record = parseTeachingLine(line, records.length);
      if (!record || record.number < 1 || record.number > EXPECTED_RECORDS || byNumber.has(record.number)) continue;
      records.push(record);
      byNumber.set(record.number, record);
      const classBucket = byClass.get(record.className) ?? [];
      classBucket.push(record);
      byClass.set(record.className, classBucket);
      const stageBucket = byStage.get(record.stage) ?? [];
      stageBucket.push(record);
      byStage.set(record.stage, stageBucket);
    }
  }
  records.sort((a, b) => a.number - b.number);
  if (records.length !== EXPECTED_RECORDS || records[0]?.number !== 1 || records.at(-1)?.number !== EXPECTED_RECORDS) {
    throw new Error(`LONG_TERM_REPAIR_CORPUS_INVALID:expected=${EXPECTED_RECORDS}:actual=${records.length}`);
  }
  cachedCorpus = Object.freeze({
    records: Object.freeze(records),
    byClass,
    byStage,
    digest: crypto.createHash('sha256')
      .update(records.map((record) => `${record.id}:${record.digest}`).join('|'), 'utf8')
      .digest('hex'),
    loadedAt: new Date().toISOString(),
  });
  return cachedCorpus;
}

function similarity(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(1, Math.min(left.size, right.size));
}

function hintClasses({ rootCause = null, features = [] } = {}) {
  const values = new Set([String(rootCause ?? '').trim(), ...features.map((value) => String(value).trim())].filter(Boolean));
  const hints = new Set();
  for (const value of values) {
    for (const [candidate, aliases] of Object.entries({
      'stale-sha': ['stale-sha', 'sha', 'target-sha'],
      lint: ['lint', 'eslint', 'eslint-unused'],
      typescript: ['typescript', 'typescript-async-contract'],
      build: ['build', 'build-chunk'],
      certification: ['certification', 'control-plane'],
      playwright: ['playwright', 'playwright-webkit', 'webkit', 'webkit-render'],
      'external-tooling': ['external-tooling', 'capi-model'],
      'memory-learning': ['memory-learning', 'learning'],
      orchestration: ['orchestration', 'workflow-schedule', 'runner-concurrency'],
      'contract-drift': ['contract-drift', 'canonical-definition', 'test-ownership'],
    })) {
      if (aliases.some((alias) => value === alias || value.includes(alias))) hints.add(candidate);
    }
  }
  return hints;
}

function diversify(scored, limit) {
  const selected = [];
  const classCounts = new Map();
  for (const item of scored) {
    const count = classCounts.get(item.record.className) ?? 0;
    if (count >= 4 && selected.length < limit - 2) continue;
    selected.push(item);
    classCounts.set(item.record.className, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function loadLongTermRepairCorpus() {
  const corpus = loadCorpus();
  return {
    authority: 'ADVISORY_ONLY',
    proofAuthority: 'CURRENT_EXACT_SHA_CI_ONLY',
    recordCount: corpus.records.length,
    firstId: corpus.records[0].id,
    lastId: corpus.records.at(-1).id,
    classCount: corpus.byClass.size,
    stageCount: corpus.byStage.size,
    digest: corpus.digest,
    loadedAt: corpus.loadedAt,
  };
}

export function retrieveLongTermTeaching({
  normalizedFailure = '',
  rootCause = null,
  features = [],
  stage = null,
  limit = 24,
} = {}) {
  const corpus = loadCorpus();
  const queryText = normalizedFailure || [rootCause, ...features].filter(Boolean).join(' ');
  const queryTokens = tokens(queryText);
  const hintedClasses = hintClasses({ rootCause, features });
  const normalizedStage = stage ? String(stage).trim() : null;
  const candidates = [];
  for (const record of corpus.records) {
    const classBoost = hintedClasses.has(record.className) ? 0.32 : 0;
    const stageBoost = normalizedStage && record.stage === normalizedStage ? 0.12 : 0;
    const textScore = similarity(queryTokens, record.tokens);
    const score = Math.min(1, classBoost + stageBoost + textScore * 0.66);
    if (score >= 0.22 || hintedClasses.has(record.className)) candidates.push({ record, score: Number(score.toFixed(4)) });
  }
  candidates.sort((a, b) => (b.score - a.score) || (a.record.number - b.record.number));
  return diversify(candidates, Math.max(1, Math.min(100, Number(limit) || 24))).map(({ record, score }) => ({
    id: record.id,
    className: record.className,
    stage: record.stage,
    trigger: record.trigger,
    invariant: record.invariant,
    action: record.action,
    teaching: record.teaching,
    verify: record.verify,
    score,
    source: 'ERROR_TEACHING_T001_T5000',
    authority: 'ADVISORY_ONLY',
  }));
}

export function assertLongTermTeachingCorpus() {
  const digest = loadLongTermRepairCorpus();
  if (digest.recordCount !== EXPECTED_RECORDS || digest.firstId !== 'T0001' || digest.lastId !== 'T5000') {
    throw new Error('LONG_TERM_REPAIR_CORPUS_ASSERTION_FAILED');
  }
  return digest;
}
