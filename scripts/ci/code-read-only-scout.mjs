#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = process.env.INVESTIGATION_DIR ?? 'diagnostics/investigation';
const OUTPUT = path.join(OUTPUT_DIR, 'code-scout-latest.json');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
const hash = (value) => createHash('sha256').update(String(value)).digest('hex');
const ignored = /(^|\/)(node_modules|dist|coverage|\.git)(\/|$)/;
const sourceFiles = tracked.filter((file) => !ignored.test(file) && /\.(mjs|cjs|js|ts|tsx|jsx|json|yml|yaml|md)$/.test(file));
const findings = [];
const counters = { filesScanned: 0, suspiciousAny: 0, todoFixme: 0, broadCatch: 0, duplicatedConstants: 0, directProcessExit: 0 };

for (const file of sourceFiles) {
  let text;
  try { text = readFileSync(path.join(ROOT, file), 'utf8'); } catch { continue; }
  counters.filesScanned++;
  const lines = text.split(/\r?\n/);
  const add = (category, severity, line, summary, evidence) => findings.push({ id: hash(`${sha}:${file}:${line}:${category}`).slice(0, 16), category, severity, target: file, line, summary, evidence });
  lines.forEach((line, index) => {
    const n = index + 1;
    if (/\bany\b/.test(line) && /:\s*any\b|<any>|\bas any\b/.test(line)) { counters.suspiciousAny++; add('type-safety', 'medium', n, 'Explicit any usage requires review.', line.trim()); }
    if (/TODO|FIXME|HACK/.test(line)) { counters.todoFixme++; add('maintenance', 'low', n, 'Maintenance marker requires ownership or closure.', line.trim()); }
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(line)) { counters.broadCatch++; add('error-handling', 'high', n, 'Empty catch block may hide root causes.', line.trim()); }
    if (/process\.exit\(0\)/.test(line)) { counters.directProcessExit++; add('control-flow', 'medium', n, 'Direct process exit may bypass structured evidence; review contract ownership.', line.trim()); }
  });
}

const basenameCounts = new Map();
for (const file of sourceFiles) {
  const base = path.basename(file);
  basenameCounts.set(base, [...(basenameCounts.get(base) ?? []), file]);
}
for (const [base, files] of basenameCounts) {
  if (files.length > 1 && /^(index|utils|helpers|constants)\.(mjs|js|ts|tsx)$/.test(base)) {
    counters.duplicatedConstants++;
    findings.push({ id: hash(`${sha}:duplicate:${base}`).slice(0, 16), category: 'structure', severity: 'low', target: files.join(', '), line: null, summary: `Repeated generic filename may indicate ambiguous ownership: ${base}.`, evidence: files });
  }
}

const report = {
  schemaVersion: 1,
  authority: 'READ_ONLY_CODE_SCOUT',
  mode: 'READ_ONLY_ANALYSIS',
  mutationPolicy: 'NO_SOURCE_MUTATION',
  reportWriteScope: OUTPUT,
  sha,
  generatedAt: new Date().toISOString(),
  scan: { trackedFiles: tracked.length, analyzedFiles: sourceFiles.length, sourceExtensions: ['mjs','cjs','js','ts','tsx','jsx','json','yml','yaml','md'] },
  counters,
  findings,
  decisionPolicy: 'Findings are hypotheses/evidence for execution agents. The scout never selects, approves, or performs a repair.',
  reportDigest: hash(JSON.stringify({ sha, counters, findings })),
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', authority: report.authority, sha, output: OUTPUT, findings: findings.length, mutationPolicy: report.mutationPolicy }, null, 2));
