#!/usr/bin/env node

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const artifactsDir = path.join(root, 'artifacts', 'ci-executive');
const outputPath = path.join(root, 'error-report.json');

const JOB_CATEGORIES = {
  'CI-001': { id: 'CI-001', name: 'TypeScript Type Checking', category: 'static-analysis', priority: 'P0' },
  'CI-002': { id: 'CI-002', name: 'ESLint Code Quality', category: 'static-analysis', priority: 'P0' },
  'CI-003': { id: 'CI-003', name: 'Registry & Contracts', category: 'contract-validation', priority: 'P0' },
  'CI-004': { id: 'CI-004', name: 'Unit Tests', category: 'testing', priority: 'P1' },
  'CI-005': { id: 'CI-005', name: 'Integration Tests', category: 'testing', priority: 'P1' },
  'CI-006': { id: 'CI-006', name: 'E2E Tests (Chromium)', category: 'testing', priority: 'P1' },
  'CI-007': { id: 'CI-007', name: 'E2E Tests (Firefox)', category: 'testing', priority: 'P1' },
  'CI-008': { id: 'CI-008', name: 'E2E Tests (WebKit)', category: 'testing', priority: 'P1' },
  'CI-009': { id: 'CI-009', name: 'Build & Artifact', category: 'build', priority: 'P0' },
  'CI-010': { id: 'CI-010', name: 'Security Audit', category: 'security', priority: 'P0' },
  'CI-011': { id: 'CI-011', name: 'Bundle Analysis', category: 'performance', priority: 'P2' },
  'CI-012': { id: 'CI-012', name: 'Localization Validation', category: 'i18n', priority: 'P1' },
  'CI-013': { id: 'CI-013', name: '20-Language UI Validation', category: 'i18n', priority: 'P1' },
  'CI-014': { id: 'CI-014', name: '20-Language SEO Validation', category: 'i18n', priority: 'P1' },
  'CI-015': { id: 'CI-015', name: '20-Language Routing Validation', category: 'i18n', priority: 'P1' },
  'CI-016': { id: 'CI-016', name: 'Tool Input Validation', category: 'tool-contract', priority: 'P0' },
  'CI-017': { id: 'CI-017', name: 'Tool Output Validation', category: 'tool-contract', priority: 'P0' },
  'CI-018': { id: 'CI-018', name: 'Tool Data Integrity', category: 'tool-contract', priority: 'P0' },
};

const summary = {
  total: 0,
  passedJobs: 0,
  failedJobs: 0,
  missingJobs: 0,
  byCategory: Object.fromEntries([...new Set(Object.values(JOB_CATEGORIES).map((job) => job.category))].map((category) => [category, 0])),
  byPriority: { P0: 0, P1: 0, P2: 0 },
  byJob: Object.fromEntries(Object.keys(JOB_CATEGORIES).map((id) => [id, 0])),
};

const jobResults = new Map();
const errors = [];
const seenErrors = new Set();

function normalize(message) {
  return String(message)
    .replace(/\b[0-9a-f]{7,40}\b/g, '<sha>')
    .replace(/\b\d+(?:\.\d+)?ms\b/g, '<duration>')
    .replace(/\/home\/runner\/work\/[^\s:]+/g, '<path>')
    .slice(0, 1000);
}

function resultFailed(result) {
  const status = typeof result?.status === 'string' ? result.status.toUpperCase() : null;
  if (status) return status !== 'PASS';
  const exitCode = Number(result?.exitCode);
  const totalErrors = Number(result?.totalErrors ?? 0);
  return !Number.isFinite(exitCode) || exitCode !== 0 || totalErrors > 0;
}

function recordResult(result) {
  if (!result?.jobId || !JOB_CATEGORIES[result.jobId]) return;
  const existing = jobResults.get(result.jobId);
  if (!existing || String(existing.completedAt ?? '') < String(result.completedAt ?? '')) {
    jobResults.set(result.jobId, result);
  }
}

function recordError(error, jobId) {
  const normalized = normalize(error.normalized ?? error.message ?? error.raw ?? '');
  const key = [
    error.jobId ?? jobId,
    error.type ?? 'unknown',
    error.line ?? '',
    normalized,
  ].join('|');
  if (seenErrors.has(key)) return;
  seenErrors.add(key);
  errors.push({
    jobId: error.jobId ?? jobId,
    jobName: error.jobName ?? JOB_CATEGORIES[jobId]?.name ?? jobId,
    category: error.category ?? JOB_CATEGORIES[jobId]?.category ?? 'unknown',
    priority: error.priority ?? JOB_CATEGORIES[jobId]?.priority ?? 'P2',
    type: error.type ?? 'unknown',
    severity: error.severity ?? 'error',
    line: error.line ?? null,
    message: error.message ?? error.raw ?? 'Unknown error',
    raw: error.raw ?? error.message ?? '',
    normalized,
    exitCode: error.exitCode ?? null,
  });
}

async function parseJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function collectFiles(dir, jobId) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, jobId);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    const data = await parseJson(entryPath);
    if (!data) continue;
    if (data.jobId) recordResult(data);
    if (entry.name === 'job-errors.json' && Array.isArray(data.errors)) {
      for (const error of data.errors) recordError({ ...error, ...data }, jobId);
    }
  }
}

function extractJobId(dirName) {
  // Direct match: CI-001
  if (JOB_CATEGORIES[dirName]) return dirName;
  // Artifact prefix: ci-executive-CI-001-<runId> or ci-executive-CI-001
  const match = dirName.match(/(CI-\d{3})/);
  if (match && JOB_CATEGORIES[match[1]]) return match[1];
  return null;
}

try {
  await mkdir(artifactsDir, { recursive: true });
  const entries = await readdir(artifactsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const jobId = extractJobId(entry.name);
    if (!jobId) continue;
    await collectFiles(path.join(artifactsDir, entry.name), jobId);
  }
} catch (error) {
  recordError({ jobId: 'AGGREGATOR', jobName: 'Aggregation', category: 'ci', priority: 'P0', message: error.message }, 'AGGREGATOR');
}

for (const [jobId, result] of jobResults) {
  const meta = JOB_CATEGORIES[jobId];
  const failed = resultFailed(result);
  if (failed) {
    summary.failedJobs += 1;
    summary.byCategory[meta.category] += 1;
    summary.byPriority[meta.priority] += 1;
    summary.byJob[jobId] = 1;
    if (!errors.some((error) => error.jobId === jobId)) {
      for (const message of result.failureEvidence ?? []) {
        recordError({
          jobId,
          jobName: result.name ?? meta.name,
          category: result.category ?? meta.category,
          priority: result.priority ?? meta.priority,
          message,
          normalized: message,
          exitCode: result.exitCode,
        }, jobId);
      }
    }
  } else {
    summary.passedJobs += 1;
  }
}

for (const jobId of Object.keys(JOB_CATEGORIES)) {
  if (!jobResults.has(jobId)) {
    summary.missingJobs += 1;
    const meta = JOB_CATEGORIES[jobId];
    recordError({
      jobId,
      jobName: meta.name,
      category: meta.category,
      priority: meta.priority,
      message: 'No result artifact was reported for this executive path.',
      normalized: 'No result artifact was reported for this executive path.',
      exitCode: null,
    }, jobId);
  }
}

summary.total = errors.length;

const counts = new Map();
for (const error of errors) {
  const key = error.normalized || error.message;
  const item = counts.get(key) ?? { count: 0, jobs: new Set(), example: error.message };
  item.count += 1;
  item.jobs.add(error.jobId);
  counts.set(key, item);
}

const topErrors = [...counts.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 10)
  .map(([message, data]) => ({ message, count: data.count, jobs: [...data.jobs].sort(), example: data.example }));

const failedP0 = [...jobResults.values()]
  .filter((result) => result.priority === 'P0' && resultFailed(result))
  .map((result) => result.jobId);

const recommendations = [];
if (!summary.failedJobs && !summary.missingJobs) {
  recommendations.push('All 18 executive paths produced PASS evidence.');
} else {
  if (failedP0.length) recommendations.push(`Fix P0 failures first: ${failedP0.join(', ')}.`);
  if (summary.missingJobs) recommendations.push('Resolve missing executive result artifacts before trusting the aggregate verdict.');
  if (errors.some((error) => error.category === 'i18n')) recommendations.push('Review i18n routing, UI, and SEO failures together for shared locale-contract regressions.');
  if (errors.some((error) => error.category === 'tool-contract')) recommendations.push('Review shared tool input/output/data invariants before patching individual tools.');
}

const report = {
  schemaVersion: 2,
  timestamp: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || 'local',
  runId: process.env.GITHUB_RUN_ID || 'local',
  verdict: summary.failedJobs === 0 && summary.missingJobs === 0 ? 'GREEN' : 'RED',
  jobCategories: JOB_CATEGORIES,
  jobResults: [...jobResults.values()].sort((a, b) => a.jobId.localeCompare(b.jobId)),
  errors,
  summary,
  rootCauseAnalysis: {
    topErrors,
    errorPatterns: Object.entries(summary.byCategory).filter(([, count]) => count > 0).map(([category, count]) => ({ category, count })),
    recommendations,
  },
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ verdict: report.verdict, jobsExpected: 18, jobsReported: jobResults.size, failedJobs: summary.failedJobs, missingJobs: summary.missingJobs, errors: summary.total }, null, 2));
process.exitCode = report.verdict === 'GREEN' ? 0 : 1;
