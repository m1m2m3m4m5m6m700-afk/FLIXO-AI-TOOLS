#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.env.ERROR_ARTIFACT_ROOT || 'artifacts';
const output = process.env.ERROR_REPORT_PATH || 'error-report.json';
const commit = process.env.GITHUB_SHA || 'local';

const TEST_CATEGORIES = {
  'TEST-001': { id: 'TEST-001', name: 'TypeScript Type Checking', category: 'typecheck', priority: 'P0' },
  'TEST-002': { id: 'TEST-002', name: 'ESLint Code Quality', category: 'lint', priority: 'P0' },
  'TEST-003': { id: 'TEST-003', name: 'Registry & Contracts Validation', category: 'contracts', priority: 'P0' },
  'TEST-004': { id: 'TEST-004', name: 'Unit Tests', category: 'unit', priority: 'P1' },
  'TEST-005': { id: 'TEST-005', name: 'Integration Tests', category: 'integration', priority: 'P1' },
  'TEST-006': { id: 'TEST-006', name: 'End-to-End Tests', category: 'e2e', priority: 'P1' },
};

const EXPECTED_BASE = ['TEST-001', 'TEST-002', 'TEST-003', 'TEST-004', 'TEST-005'];
const EXPECTED_E2E = ['1/4', '2/4', '3/4', '4/4'].flatMap((shard) => ['chromium', 'firefox', 'webkit'].map((browser) => `TEST-006:${browser}:${shard}`));
const EXPECTED_IDENTITIES = [...EXPECTED_BASE, ...EXPECTED_E2E];

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === 'result.json') result.push(full);
    }
  };
  walk(dir);
  return result;
}

function readResults() {
  return collectFiles(root).map((file) => {
    try {
      return { ...JSON.parse(fs.readFileSync(file, 'utf8')), _artifact: file };
    } catch (error) {
      return { testId: 'UNKNOWN', status: 'failure', output: `Unable to parse ${file}: ${error.message}`, _artifact: file };
    }
  });
}

function identityOf(result) {
  return result.testId === 'TEST-006' ? `TEST-006:${result.browser || 'unknown'}:${result.shard || 'unknown'}` : (result.testId || 'UNKNOWN');
}

function classify(message, category) {
  const text = `${category} ${message}`;
  if (/TS\d+|typeerror|cannot find module|type '.*' is not assignable|typescript/i.test(text)) return 'TypeError';
  if (/eslint|lint|no-unused|prettier/i.test(text)) return 'LintError';
  if (/contract|registry|router|route|validation failed|canonical/i.test(text)) return 'ContractError';
  return 'TestError';
}

function extractMessages(result, meta) {
  if (result.status === 'success') return [];
  const output = typeof result.output === 'string' ? result.output : '';
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.filter((line) => /error|failed|failure|timeout|TS\d+/i.test(line));
  return (candidates.length ? candidates : [result.message || `${meta.name} failed`]).map((message) => ({
    testId: meta.id, testName: meta.name, priority: meta.priority, category: meta.category,
    type: classify(message, meta.category), browser: result.browser || null, shard: result.shard || null,
    file: result.file || null, message,
  }));
}

function topErrors(errors, limit = 5) {
  const counts = new Map();
  for (const error of errors) {
    const key = error.message.replace(/\s+/g, ' ').slice(0, 160);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([message, count]) => ({ message, count }));
}

function detectPatterns(errors) {
  const patterns = new Map();
  for (const error of errors) {
    const key = `${error.category}:${error.type}`;
    patterns.set(key, (patterns.get(key) || 0) + 1);
  }
  return [...patterns.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => {
    const [category, type] = key.split(':');
    return { category, type, count, severity: count >= 5 ? 'high' : count > 1 ? 'medium' : 'low' };
  });
}

function recommendations(errors, missing, duplicates) {
  const result = [];
  const p0 = errors.filter((error) => error.priority === 'P0').length;
  const p1 = errors.filter((error) => error.priority === 'P1').length;
  if (missing.length) result.push(`Restore missing evidence first: ${missing.join(', ')}.`);
  if (duplicates.length) result.push(`Remove duplicate evidence identities: ${duplicates.join(', ')}.`);
  if (p0) result.push(`Fix ${p0} P0 errors before P1 runtime/test failures.`);
  if (p1) result.push(`Address ${p1} P1 test/runtime errors after P0 stabilization.`);
  if (!result.length) result.push('No corrective action required: all expected test evidence passed.');
  return result;
}

function main() {
  const results = readResults();
  const seen = new Set();
  const duplicates = [];
  const errors = [];

  for (const result of results) {
    const identity = identityOf(result);
    if (seen.has(identity)) duplicates.push(identity);
    seen.add(identity);
    const meta = TEST_CATEGORIES[result.testId];
    if (!meta) {
      errors.push({ testId: 'UNKNOWN', testName: 'Unknown Test', priority: 'P2', category: 'unknown', type: 'TestError', browser: result.browser || null, shard: result.shard || null, file: result._artifact || null, message: `Unknown test identity: ${identity}.` });
      continue;
    }
    errors.push(...extractMessages(result, meta));
  }

  const missing = EXPECTED_IDENTITIES.filter((identity) => !seen.has(identity));
  for (const identity of missing) {
    const baseId = identity.split(':')[0];
    const meta = TEST_CATEGORIES[baseId];
    errors.push({ testId: meta.id, testName: meta.name, priority: 'P0', category: meta.category, type: 'TestError', browser: identity.split(':')[1] || null, shard: identity.split(':')[2] || null, file: null, message: `Missing result artifact identity: ${identity}.` });
  }
  for (const identity of duplicates) {
    const baseId = identity.split(':')[0];
    errors.push({ testId: baseId, testName: 'Evidence Integrity', priority: 'P0', category: TEST_CATEGORIES[baseId]?.category || 'unknown', type: 'TestError', browser: identity.split(':')[1] || null, shard: identity.split(':')[2] || null, file: null, message: `Duplicate result artifact identity: ${identity}.` });
  }

  const byCategory = Object.fromEntries(Object.values(TEST_CATEGORIES).map((meta) => [meta.category, errors.filter((error) => error.category === meta.category).length]));
  const byPriority = { P0: errors.filter((error) => error.priority === 'P0').length, P1: errors.filter((error) => error.priority === 'P1').length, P2: errors.filter((error) => error.priority === 'P2').length };
  const report = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    commit,
    testCategories: TEST_CATEGORIES,
    execution: { expectedIdentities: EXPECTED_IDENTITIES.length, receivedResults: results.length, uniqueIdentities: seen.size, failedResults: results.filter((r) => r.status !== 'success').length, missingEvidence: missing, duplicateEvidence: duplicates },
    errors,
    summary: { total: errors.length, byCategory, byPriority, expectedResults: EXPECTED_IDENTITIES.length, receivedResults: results.length },
    rootCauseAnalysis: { topErrors: topErrors(errors), errorPatterns: detectPatterns(errors), recommendations: recommendations(errors, missing, duplicates) },
  };

  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${output}: ${errors.length} error(s).`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (errors.length > 0 || results.length !== EXPECTED_IDENTITIES.length || missing.length || duplicates.length) process.exitCode = 1;
}

main();
