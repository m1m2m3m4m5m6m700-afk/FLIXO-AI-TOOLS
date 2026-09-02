#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
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
  byCategory: {},
  byPriority: { P0: 0, P1: 0, P2: 0 },
  byJob: {},
};

for (const job of Object.values(JOB_CATEGORIES)) {
  summary.byCategory[job.category] = 0;
  summary.byJob[job.id] = 0;
}

const errors = [];
const jobResults = [];

function normalizeMessage(value) {
  return String(value)
    .replace(/\b(?:at|file):?\s+[^\s]+/gi, '<path>')
    .replace(/\b[0-9a-f]{7,40}\b/g, '<sha>')
    .replace(/\d+(?:\.\d+)?ms/g, '<duration>')
    .trim()
    .slice(0, 500);
}

async function loadResults() {
  let entries;
  try {
    entries = await readdir(artifactsDir, { withFileTypes: true });
  } catch (error) {
    console.warn(`⚠️ No executive artifacts directory: ${error.message}`);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const jobId = entry.name;
    const meta = JOB_CATEGORIES[jobId];
    const resultFile = path.join(artifactsDir, jobId, 'result.json');

    try {
      const raw = await readFile(resultFile, 'utf8');
      const result = JSON.parse(raw);
      jobResults.push(result);

      if (result.status === 'PASS') summary.passedJobs += 1;
      else summary.failedJobs += 1;

      if (meta) {
        summary.byCategory[meta.category] += result.status === 'PASS' ? 0 : 1;
        summary.byPriority[meta.priority] += result.status === 'PASS' ? 0 : 1;
        summary.byJob[meta.id] = result.status === 'PASS' ? 0 : 1;
      }

      for (const line of result.failureEvidence ?? []) {
        errors.push({
          jobId: result.jobId ?? jobId,
          jobName: result.name ?? meta?.name ?? 'Unknown',
          category: result.category ?? meta?.category ?? 'unknown',
          priority: result.priority ?? meta?.priority ?? 'P2',
          message: line,
          normalized: normalizeMessage(line),
          exitCode: result.exitCode,
        });
      }
    } catch (error) {
      summary.missingJobs += 1;
      errors.push({
        jobId,
        jobName: meta?.name ?? 'Unknown',
        category: meta?.category ?? 'unknown',
        priority: meta?.priority ?? 'P2',
        message: `Missing or invalid result.json: ${error.message}`,
        normalized: normalizeMessage(error.message),
        exitCode: null,
      });
    }
  }
}

function getTopErrors(items, limit = 10) {
  const counts = new Map();
  for (const item of items) {
    const key = item.normalized || item.message;
    const current = counts.get(key) ?? { count: 0, jobs: new Set(), example: item.message };
    current.count += 1;
    current.jobs.add(item.jobId);
    counts.set(key, current);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([message, data]) => ({ message, count: data.count, jobs: [...data.jobs].sort(), example: data.example }));
}

function detectPatterns(items) {
  const patterns = new Map();
  for (const item of items) {
    const key = `${item.category}:${item.priority}`;
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }
  return [...patterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => ({ pattern, count }));
}

function generateRecommendations(items, results) {
  const recommendations = [];
  const failedJobs = results.filter((result) => result.status !== 'PASS');
  const p0Failures = new Set(items.filter((item) => item.priority === 'P0').map((item) => item.jobId));

  if (failedJobs.length === 0 && summary.missingJobs === 0) {
    recommendations.push('All 18 executive paths produced PASS evidence. Keep the gate as the release signal.');
    return recommendations;
  }
  if (p0Failures.size) recommendations.push(`Fix P0 failures first: ${[...p0Failures].sort().join(', ')}.`);
  if (summary.missingJobs) recommendations.push('Investigate missing/invalid result artifacts before trusting the aggregate verdict.');
  if (items.some((item) => item.category === 'i18n')) recommendations.push('Review i18n failures as a group; routing, SEO, and UI regressions often share a locale-contract root cause.');
  if (items.some((item) => item.category === 'tool-contract')) recommendations.push('Review tool-contract failures against shared input/output/data invariants before patching individual tools.');
  if (items.some((item) => item.category === 'testing')) recommendations.push('Use the browser/test failure artifacts to isolate cross-browser versus test-environment failures.');
  return recommendations;
}

await loadResults();

for (const id of Object.keys(JOB_CATEGORIES)) {
  if (!jobResults.some((result) => result.jobId === id)) summary.missingJobs += 1;
}
summary.total = errors.length;

const failedJobs = jobResults.filter((result) => result.status !== 'PASS').length;
const report = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || 'local',
  runId: process.env.GITHUB_RUN_ID || 'local',
  verdict: failedJobs === 0 && summary.missingJobs === 0 ? 'GREEN' : 'RED',
  jobCategories: JOB_CATEGORIES,
  jobResults: jobResults.sort((a, b) => String(a.jobId).localeCompare(String(b.jobId))),
  errors,
  summary,
  rootCauseAnalysis: {
    topErrors: getTopErrors(errors, 10),
    errorPatterns: detectPatterns(errors),
    recommendations: generateRecommendations(errors, jobResults),
  },
};

await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  verdict: report.verdict,
  jobsExpected: Object.keys(JOB_CATEGORIES).length,
  jobsReported: jobResults.length,
  failedJobs,
  missingJobs: summary.missingJobs,
  errors: errors.length,
}, null, 2));

process.exitCode = report.verdict === 'GREEN' ? 0 : 1;
