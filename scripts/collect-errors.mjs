#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.env.ERROR_ARTIFACT_ROOT || 'artifacts';
const output = process.env.ERROR_REPORT_PATH || 'error-report.json';
const commit = process.env.GITHUB_SHA || 'local';

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

const EXPECTED = Object.keys(JOB_CATEGORIES);

function collectResultFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === 'result.json') files.push(full);
    }
  };
  walk(dir);
  return files;
}

function normalizeMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function classify(error, meta) {
  const text = `${error} ${meta.category}`.toLowerCase();
  if (/ts\d+|typescript|typeerror|not assignable|cannot find module/.test(text)) return 'TypeError';
  if (/eslint|lint|no-unused|prettier/.test(text)) return 'LintError';
  if (/contract|registry|router|canonical|validation/.test(text)) return 'ContractError';
  if (/timeout|timed out/.test(text)) return 'TimeoutError';
  if (/audit|vulnerabil/.test(text)) return 'SecurityError';
  return 'TestError';
}

function extractErrors(result, meta) {
  if (result.status === 'success') return [];
  const output = typeof result.output === 'string' ? result.output : '';
  const lines = output.split(/\r?\n/).map(normalizeMessage).filter(Boolean);
  const candidates = lines.filter((line) => /\b(error|fail|failed|failure|timeout|timed out|TS\d+)\b/i.test(line));
  const messages = candidates.length ? candidates : [result.message || `${meta.name} failed`];
  return messages.slice(0, 50).map((message) => ({
    testId: meta.id,
    testName: meta.name,
    priority: meta.priority,
    category: meta.category,
    type: classify(message, meta),
    message,
  }));
}

function topErrors(errors, limit = 5) {
  const counts = new Map();
  for (const error of errors) {
    const key = normalizeMessage(error.message);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([message, count]) => ({ message, count }));
}

function detectPatterns(errors) {
  const map = new Map();
  for (const error of errors) {
    const key = `${error.category}:${error.type}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => {
    const [category, type] = key.split(':');
    return { category, type, count, severity: count >= 5 ? 'high' : count > 1 ? 'medium' : 'low' };
  });
}

function recommendations(errors, missing, duplicates) {
  const recs = [];
  const p0 = errors.filter((e) => e.priority === 'P0').length;
  const p1 = errors.filter((e) => e.priority === 'P1').length;
  if (missing.length) recs.push(`Restore missing evidence first: ${missing.join(', ')}.`);
  if (duplicates.length) recs.push(`Remove duplicate evidence identities: ${duplicates.join(', ')}.`);
  if (p0) recs.push(`Fix ${p0} P0 error(s) before P1 failures.`);
  if (p1) recs.push(`Address ${p1} P1 test/runtime error(s) after P0 stabilization.`);
  if (!recs.length) recs.push('No corrective action required: all expected CI evidence passed.');
  return recs;
}

const files = collectResultFiles(root);
const results = [];
const parseErrors = [];
for (const file of files) {
  try {
    results.push({ ...JSON.parse(fs.readFileSync(file, 'utf8')), _artifact: file });
  } catch (error) {
    parseErrors.push({ file, message: `Unable to parse result.json: ${error.message}` });
  }
}

const seen = new Map();
const duplicates = [];
for (const result of results) {
  const id = result.testId || 'UNKNOWN';
  if (seen.has(id)) duplicates.push(id);
  seen.set(id, (seen.get(id) || 0) + 1);
}

const missing = EXPECTED.filter((id) => !seen.has(id));
const errors = [];
for (const result of results) {
  const meta = JOB_CATEGORIES[result.testId];
  if (!meta) {
    errors.push({ testId: result.testId || 'UNKNOWN', testName: 'Unknown CI Job', priority: 'P0', category: 'unknown', type: 'EvidenceError', message: `Unknown CI result identity: ${result.testId || 'UNKNOWN'}.` });
    continue;
  }
  errors.push(...extractErrors(result, meta));
}
for (const id of missing) {
  const meta = JOB_CATEGORIES[id];
  errors.push({ testId: id, testName: meta.name, priority: 'P0', category: meta.category, type: 'EvidenceError', message: `Missing result artifact for ${id}.` });
}
for (const id of duplicates) {
  const meta = JOB_CATEGORIES[id] || { name: 'Unknown CI Job', category: 'unknown' };
  errors.push({ testId: id, testName: meta.name, priority: 'P0', category: meta.category, type: 'EvidenceError', message: `Duplicate result artifact identity for ${id}.` });
}
for (const item of parseErrors) {
  errors.push({ testId: 'UNKNOWN', testName: 'Evidence Parser', priority: 'P0', category: 'unknown', type: 'EvidenceError', file: item.file, message: item.message });
}

const categories = [...new Set(Object.values(JOB_CATEGORIES).map((job) => job.category))];
const byCategory = Object.fromEntries(categories.map((category) => [category, errors.filter((error) => error.category === category).length]));
const byPriority = {
  P0: errors.filter((e) => e.priority === 'P0').length,
  P1: errors.filter((e) => e.priority === 'P1').length,
  P2: errors.filter((e) => e.priority === 'P2').length,
};

const report = {
  schemaVersion: 2,
  timestamp: new Date().toISOString(),
  commit,
  jobCategories: JOB_CATEGORIES,
  execution: {
    expectedJobs: EXPECTED.length,
    receivedResults: results.length,
    uniqueJobIds: seen.size,
    failedResults: results.filter((r) => r.status !== 'success').length,
    missingEvidence: missing,
    duplicateEvidence: duplicates,
    parseErrors,
  },
  errors,
  summary: { total: errors.length, byCategory, byPriority, expectedJobs: EXPECTED.length, receivedResults: results.length },
  rootCauseAnalysis: {
    topErrors: topErrors(errors),
    errorPatterns: detectPatterns(errors),
    recommendations: recommendations(errors, missing, duplicates),
  },
};

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.total !== 0 || report.execution.receivedResults !== EXPECTED.length || missing.length || duplicates.length || parseErrors.length) process.exitCode = 1;
