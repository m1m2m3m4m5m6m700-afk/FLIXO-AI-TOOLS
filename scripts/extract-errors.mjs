#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback = undefined) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;

const type = getArg('--type', 'unknown');
const inputFile = getArg('--input');
const outputFile = getArg('--output', 'artifacts/errors.json');
const exitCode = Number.parseInt(getArg('--exit-code', '0'), 10);
const command = getArg('--command', 'unknown');
const jobId = getArg('--job-id', 'UNKNOWN');
const jobName = getArg('--job-name', jobId);
const category = getArg('--category', 'unknown');
const priority = getArg('--priority', 'P2');

if (!inputFile) {
  console.error('Usage: extract-errors.mjs --input=<file> [--output=<file>] [--type=<type>] [--exit-code=<n>]');
  process.exit(2);
}

const patterns = [
  { regex: /error\s+TS(\d+)\s*:\s*(.+)/i, type: 'typescript', severity: 'error', message: (m) => `TS${m[1]}: ${m[2]}` },
  { regex: /(?:^|\s)error(?:\s+[^:]+)?\s*:\s*(.+)/i, type: 'tooling', severity: 'error', message: (m) => m[1] },
  { regex: /\berror\s{2,}(.+?)\s{2,}(.+)/i, type: 'eslint', severity: 'error', message: (m) => `${m[1]} — ${m[2]}` },
  { regex: /\b(?:Error|UnhandledError):\s*(.+)/i, type: 'runtime', severity: 'error', message: (m) => m[1] },
  { regex: /\b(?:TypeError|ReferenceError|SyntaxError|RangeError):\s*(.+)/i, type: 'javascript', severity: 'error', message: (m) => m[1] },
  { regex: /^\s*(?:FAIL|Failed|FAILED)\b\s*(.*)$/i, type: 'test', severity: 'failure', message: (m) => m[1] || 'Test failure' },
  { regex: /\b(?:AssertionError|AssertionFailedError):\s*(.+)/i, type: 'assertion', severity: 'failure', message: (m) => m[1] },
  { regex: /\b(?:timeout|timed out|ETIMEDOUT)\b\s*[:-]?\s*(.*)/i, type: 'timeout', severity: 'error', message: (m) => m[1] || 'Timeout' },
  { regex: /\b(?:fatal|panic):\s*(.+)/i, type: 'fatal', severity: 'error', message: (m) => m[1] },
  { regex: /\bexpect\([^)]*\)\.(?:toBe|toEqual|toHave|toContain|toMatch|toBeVisible)[^\n]*/i, type: 'assertion', severity: 'failure', message: (m) => m[0] },
];

function normalizeMessage(message) {
  return String(message)
    .replace(/\b[0-9a-f]{7,40}\b/g, '<sha>')
    .replace(/\b\d+(?:\.\d+)?ms\b/g, '<duration>')
    .replace(/\/home\/runner\/work\/[^\s:]+/g, '<path>')
    .trim()
    .slice(0, 1000);
}

const content = await readFile(inputFile, 'utf8');
const errors = [];

for (const [lineNumber, line] of content.split(/\r?\n/).entries()) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;
    errors.push({
      line: lineNumber + 1,
      type: pattern.type,
      severity: pattern.severity,
      message: pattern.message(match),
      normalized: normalizeMessage(pattern.message(match)),
      raw: trimmed.slice(0, 2000),
    });
    break;
  }
}

if (exitCode !== 0 && errors.length === 0) {
  const tail = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-25);
  for (const line of tail) {
    errors.push({
      line: null,
      type: 'command-exit',
      severity: 'error',
      message: line.slice(0, 1000),
      normalized: normalizeMessage(line),
      raw: line.slice(0, 2000),
    });
  }
}

const report = {
  schemaVersion: 1,
  job: type,
  jobId,
  jobName,
  category,
  priority,
  command,
  exitCode,
  timestamp: new Date().toISOString(),
  totalErrors: errors.length,
  errors,
};

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`✅ Extracted ${errors.length} errors to ${outputFile}`);
