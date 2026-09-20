#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const DIR = path.resolve(ROOT, process.env.FLIXO_HISTORICAL_ERROR_DIR ?? 'docs/agents/historical-action-errors');
const INDEX_FILE = path.join(DIR, 'index.json');
const MANIFEST_FILE = path.join(DIR, 'manifest.json');
const RECORDS_DIR = path.join(DIR, 'records');

const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const normalize = (line) => String(line)
  .replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu, '')
  .replace(/https?:\/\/[^\s]+/gu, '<URL>')
  .replace(/0x[0-9a-f]+/giu, '<HEX>')
  .replace(/\b\d{8,}\b/gu, '<N>')
  .replace(/\s+/gu, ' ')
  .trim();

function classify(line) {
  const x = normalize(line).toLowerCase();
  if (/typescript|ts\d{3,4}|cannot find name|type .* is not assignable/iu.test(x)) return 'typescript';
  if (/eslint|no-unused|lint/iu.test(x)) return 'lint';
  if (/playwright|expect\(|browser|webkit|firefox|chromium/iu.test(x)) return 'browser-test';
  if (/npm (err|error)|npm ci|npm install|lockfile/iu.test(x)) return 'dependency';
  if (/vite|rollup|module not found|chunk/iu.test(x)) return 'build';
  if (/timeout|timed out|cancelled|canceled|queued/iu.test(x)) return 'runner-control';
  if (/permission|forbidden|unauthorized|403|401/iu.test(x)) return 'permissions';
  if (/vercel|deployment|api-deployments-free/iu.test(x)) return 'provider-deployment';
  if (/supabase|postgres|database|pgrst/iu.test(x)) return 'database';
  if (/codeql|security/iu.test(x)) return 'security';
  if (/assert|assertion|failed|failure|error|exception|fatal/iu.test(x)) return 'generic-failure';
  return 'diagnostic';
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function emptyIndex() {
  return {
    schemaVersion: 2,
    authority: 'HISTORICAL_OBSERVATION_ONLY',
    source: 'github-actions-logs',
    externalDiagnosis: false,
    proofAuthority: 'CURRENT_EXACT_SHA_CI_ONLY',
    byFingerprint: {},
    byNormalized: {},
    byClass: {},
    byWorkflow: {},
    recordCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

function emptyManifest() {
  return {
    schemaVersion: 2,
    name: 'FLIXO-HISTORICAL-ACTION-ERROR-CORPUS',
    source: 'github-actions-logs',
    authority: 'historical-observation',
    externalDiagnosis: false,
    exactShaRequired: true,
    repositoryCreatedAt: '2026-08-10T14:20:17Z',
    nextCursor: '2026-08-10T00:00:00Z',
    coverageStart: null,
    coverageEnd: null,
    totalRunsScanned: 0,
    failedRunsScanned: 0,
    jobsScanned: 0,
    logJobsScanned: 0,
    errorOccurrences: 0,
    uniqueRecords: 0,
    shards: [],
    updatedAt: new Date().toISOString(),
  };
}

function load() {
  fs.mkdirSync(RECORDS_DIR, { recursive: true });
  return {
    index: readJson(INDEX_FILE, emptyIndex()),
    manifest: readJson(MANIFEST_FILE, emptyManifest()),
  };
}

export function mergeOccurrences(input) {
  const { index, manifest } = load();
  for (const occurrence of input.occurrences ?? []) {
    const raw = normalize(occurrence.rawLine);
    if (!raw) continue;
    const fingerprint = sha256([occurrence.workflow, occurrence.job, raw].join('\0'));
    const id = 'HAE-' + fingerprint.slice(0, 24);
    const file = path.join(RECORDS_DIR, id + '.json');
    const existing = readJson(file, null);
    const now = occurrence.seenAt ?? new Date().toISOString();
    const record = existing ?? {
      schemaVersion: 2,
      id,
      fingerprint,
      source: 'github-actions-log',
      authority: 'historical-observation',
      externalDiagnosis: false,
      exactSha: true,
      workflow: String(occurrence.workflow ?? 'unknown'),
      job: String(occurrence.job ?? 'unknown'),
      errorClass: classify(raw),
      normalized: raw,
      rawExamples: [],
      occurrenceCount: 0,
      runs: [],
      shas: [],
      branches: [],
      firstSeen: now,
      lastSeen: now,
    };
    record.occurrenceCount += 1;
    record.lastSeen = now;
    if (now < record.firstSeen) record.firstSeen = now;
    if (record.rawExamples.length < 5 && !record.rawExamples.includes(String(occurrence.rawLine))) record.rawExamples.push(String(occurrence.rawLine));
    if (occurrence.runId != null && record.runs.length < 50 && !record.runs.includes(String(occurrence.runId))) record.runs.push(String(occurrence.runId));
    if (occurrence.sha && record.shas.length < 50 && !record.shas.includes(String(occurrence.sha))) record.shas.push(String(occurrence.sha));
    if (occurrence.branch && record.branches.length < 20 && !record.branches.includes(String(occurrence.branch))) record.branches.push(String(occurrence.branch));
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    const add = (map, key) => {
      if (!key) return;
      const list = Array.isArray(map[key]) ? map[key] : [];
      if (!list.includes(id)) list.push(id);
      map[key] = list.slice(0, 200);
    };
    add(index.byFingerprint, fingerprint);
    add(index.byNormalized, raw);
    add(index.byClass, record.errorClass);
    add(index.byWorkflow, record.workflow);
    if (!existing) index.recordCount += 1;
  }
  manifest.totalRunsScanned += Number(input.runCount ?? 0);
  manifest.failedRunsScanned += Number(input.failedRunCount ?? 0);
  manifest.jobsScanned += Number(input.jobCount ?? 0);
  manifest.logJobsScanned += Number(input.logJobCount ?? 0);
  manifest.errorOccurrences = [...new Set(fs.readdirSync(RECORDS_DIR).filter((name) => name.endsWith('.json')))]
    .reduce((n, name) => n + Number(readJson(path.join(RECORDS_DIR, name), {}).occurrenceCount ?? 0), 0);
  manifest.uniqueRecords = fs.readdirSync(RECORDS_DIR).filter((name) => name.endsWith('.json')).length;
  if (input.start && (!manifest.coverageStart || input.start < manifest.coverageStart)) manifest.coverageStart = input.start;
  if (input.end && (!manifest.coverageEnd || input.end > manifest.coverageEnd)) manifest.coverageEnd = input.end;
  if (input.end && (!manifest.nextCursor || input.end > manifest.nextCursor)) manifest.nextCursor = input.end;
  manifest.updatedAt = new Date().toISOString();
  index.updatedAt = manifest.updatedAt;
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n');
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
  return { uniqueRecords: manifest.uniqueRecords, errorOccurrences: manifest.errorOccurrences };
}

export function query(term, limit = 20) {
  const { index } = load();
  const q = normalize(term);
  const ids = new Set([...(index.byFingerprint[q] ?? []), ...(index.byNormalized[q] ?? [])]);
  const exact = [...ids].map((id) => readJson(path.join(RECORDS_DIR, id + '.json'), null)).filter(Boolean);
  if (exact.length) return exact.slice(0, Math.max(1, Number(limit)));
  const needle = q.toLowerCase();
  return Object.values(index.byNormalized).flat()
    .map((id) => readJson(path.join(RECORDS_DIR, id + '.json'), null))
    .filter(Boolean)
    .filter((record) => record.normalized.toLowerCase().includes(needle))
    .slice(0, Math.max(1, Number(limit)));
}

const command = process.argv[2] ?? 'help';
if (command === 'add') {
  const input = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  console.log(JSON.stringify(mergeOccurrences(input), null, 2));
} else if (command === 'query') {
  console.log(JSON.stringify({ results: query(process.argv[3] ?? '', Number(process.argv[4] ?? 20)) }, null, 2));
} else {
  console.log('Usage: historical-action-error-index.mjs add <json> | query <term> [limit]');
}
