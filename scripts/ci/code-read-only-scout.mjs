#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = process.env.INVESTIGATION_DIR ?? 'diagnostics/investigation';
const OUTPUT = path.join(OUTPUT_DIR, 'code-scout-latest.json');
const KNOWLEDGE_PATH = path.join(ROOT, 'docs/ci/investigation/HISTORICAL-KNOWLEDGE-BASE.json');
const CONTRACT_PATH = path.join(ROOT, 'docs/ci/investigation/INVESTIGATION-REPORT-CONTRACT.json');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
const hash = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const ignored = /(^|\/)(node_modules|dist|coverage|\.git)(\/|$)|(^|\/)(\.env(?:\.|$)|.*\.(?:pem|key))$/u;
const sourceFiles = tracked.filter((file) => !ignored.test(file) && /\.(mjs|cjs|js|ts|tsx|jsx|json|yml|yaml|md)$/.test(file));
const knowledge = JSON.parse(readFileSync(KNOWLEDGE_PATH, 'utf8'));
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const findings = [];
const counters = { filesScanned: 0, suspiciousAny: 0, todoFixme: 0, broadCatch: 0, duplicatedGenericFiles: 0, directProcessExit: 0 };
const texts = new Map();

for (const file of sourceFiles) {
  let text;
  try { text = readFileSync(path.join(ROOT, file), 'utf8'); } catch { continue; }
  texts.set(file, text);
  counters.filesScanned++;
  const lines = text.split(/\r?\n/);
  const add = (category, severity, line, summary, evidence) => findings.push({ findingId: hash(`${sha}:${file}:${line}:${category}`).slice(0, 16), category, severity, confidence: 0.65, target: file, line, summary, evidence: [evidence], historicalMatches: [], rootCauseHypotheses: ['pattern requires causal verification; scout does not assert root cause'], affectedContracts: [], suggestedVerification: ['inspect exact occurrence and owning contract'], decisionRequired: 'INVESTIGATE' });
  lines.forEach((line, index) => {
    const n = index + 1;
    if (/\bany\b/.test(line) && /:\s*any\b|<any>|\bas any\b/.test(line)) { counters.suspiciousAny++; add('type-safety', 'medium', n, 'Explicit any usage requires review.', line.trim()); }
    if (/TODO|FIXME|HACK/.test(line)) { counters.todoFixme++; add('maintenance', 'low', n, 'Maintenance marker requires ownership or closure.', line.trim()); }
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(line)) { counters.broadCatch++; add('error-handling', 'high', n, 'Empty catch block may hide root causes.', line.trim()); }
    if (/process\.exit\(0\)/.test(line)) { counters.directProcessExit++; add('control-flow', 'medium', n, 'Direct process exit may bypass structured evidence; review contract ownership.', line.trim()); }
  });
}

const basenameCounts = new Map();
for (const file of sourceFiles) { const base = path.basename(file); basenameCounts.set(base, [...(basenameCounts.get(base) ?? []), file]); }
for (const [base, files] of basenameCounts) {
  if (files.length > 1 && /^(index|utils|helpers|constants)\.(mjs|js|ts|tsx)$/.test(base)) {
    counters.duplicatedGenericFiles++;
    findings.push({ findingId: hash(`${sha}:duplicate:${base}`).slice(0, 16), category: 'structure', severity: 'low', confidence: 0.55, target: files.join(', '), line: null, summary: `Repeated generic filename may indicate ambiguous ownership: ${base}.`, evidence: files, historicalMatches: [], rootCauseHypotheses: ['possible ownership ambiguity'], affectedContracts: [], suggestedVerification: ['inspect import graph and authoritative owner'], decisionRequired: 'INVESTIGATE' });
  }
}

const corpus = [...texts.entries()].map(([file, content]) => `${file}\n${content}`).join('\n').toLowerCase();
const historicalMatches = knowledge.sources.map((source) => {
  const matchedPatterns = source.patterns.filter((pattern) => corpus.includes(String(pattern).toLowerCase().slice(0, Math.min(48, String(pattern).length))));
  return { id: source.id, historicalFile: source.historicalFile ?? null, sourceCommit: source.sourceCommit ?? null, matchedPatterns: matchedPatterns.slice(0, 8), matchCount: matchedPatterns.length };
}).filter((entry) => entry.matchCount > 0);

for (const finding of findings) {
  const related = historicalMatches.filter((entry) => entry.matchedPatterns.some((p) => finding.summary.toLowerCase().includes(String(p).toLowerCase().slice(0, 24))));
  finding.historicalMatches = related.slice(0, 4).map((entry) => ({ sourceId: entry.id, matchedPatterns: entry.matchedPatterns.slice(0, 3) }));
}

const base = {
  schemaVersion: contract.schemaVersion,
  authority: 'READ_ONLY_CODE_SCOUT',
  mode: 'READ_ONLY_ANALYSIS',
  mutationPolicy: 'NO_SOURCE_MUTATION',
  reportWriteScope: OUTPUT,
  scannedSha: sha,
  generatedAt: new Date().toISOString(),
  scan: { trackedFiles: tracked.length, analyzedFiles: sourceFiles.length },
  counters,
  findings,
  historicalMatches,
  graphSummary: { sourceFiles: sourceFiles.length, historicalSources: knowledge.sources.length, findings: findings.length },
  unknowns: [],
  decisionPolicy: 'Findings are evidence-backed hypotheses for execution agents. The scout never selects, approves, or performs a repair.',
};
const report = { ...base, digest: hash(JSON.stringify(base)) };
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', authority: report.authority, mode: report.mode, scannedSha: sha, output: OUTPUT, findings: findings.length, historicalMatches: historicalMatches.length }, null, 2));
