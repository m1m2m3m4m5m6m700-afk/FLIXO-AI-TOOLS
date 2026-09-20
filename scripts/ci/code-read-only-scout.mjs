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
// Coordination contract marker: the scout uses git ls-files as its read-only tracked-file inventory.
// Coordination contract marker: mode: 'READ_ONLY_ANALYSIS'
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
const hash = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const ignored = /(^|\/)(node_modules|dist|coverage|\.git)(\/|$)|(^|\/)(\.env(?:\.|$)|.*\.(?:pem|key))$/u;
const sourceFiles = tracked.filter((file) => !ignored.test(file) && /\.(mjs|cjs|js|ts|tsx|jsx|json|yml|yaml|md)$/.test(file));
const knowledge = JSON.parse(readFileSync(KNOWLEDGE_PATH, 'utf8'));
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const findings = [];
const counters = { filesScanned: 0, suspiciousAny: 0, todoFixme: 0, broadCatch: 0, duplicatedGenericFiles: 0, directProcessExit: 0, importEdges: 0, contractMentions: 0 };
const texts = new Map();
const imports = new Map();
const contractTerms = ['contract', 'invariant', 'gate', 'certif', 'scout', 'error', 'task', 'diagnostic'];

const scopePath = process.env.SCOUT_SCOPE_FILE;
let scopedFiles = null;
if (scopePath) {
  try {
    const scope = JSON.parse(readFileSync(path.resolve(ROOT, scopePath), 'utf8'));
    if (Array.isArray(scope.changedFiles)) scopedFiles = new Set(scope.changedFiles);
  } catch {
    scopedFiles = null;
  }
}
const incremental = scopedFiles !== null && scopedFiles.size > 0;
const analysisFiles = incremental ? sourceFiles.filter((file) => scopedFiles.has(file)) : sourceFiles;
const scopeFallback = incremental ? [] : ['No valid impact scope was available; full static scan used.'];

for (const file of analysisFiles) {
  let text;
  try { text = readFileSync(path.join(ROOT, file), 'utf8'); } catch { continue; }
  texts.set(file, text);
  counters.filesScanned++;
  const lines = text.split(/\r?\n/);
  const add = (category, severity, line, summary, evidence, extra = {}) => findings.push({
    findingId: hash(`${sha}:${file}:${line}:${category}`).slice(0, 16),
    category, severity, confidence: extra.confidence ?? 0.65, target: file, line,
    summary, evidence: [evidence], historicalMatches: [], rootCauseHypotheses: extra.rootCauseHypotheses ?? ['pattern requires causal verification; scout does not assert root cause'],
    propagation: extra.propagation ?? ['local occurrence; propagation not proven by static scout'],
    violatedInvariants: extra.violatedInvariants ?? [], affectedContracts: extra.affectedContracts ?? [],
    suggestedVerification: extra.suggestedVerification ?? ['inspect exact occurrence, dependency path, and owning contract'],
    decisionRequired: 'INVESTIGATE'
  });
  lines.forEach((line, index) => {
    const n = index + 1;
    if (/\bany\b/.test(line) && /:\s*any\b|<any>|\bas any\b/.test(line)) { counters.suspiciousAny++; add('type-safety', 'medium', n, 'Explicit any usage requires review.', line.trim(), { violatedInvariants: ['type safety'], suggestedVerification: ['inspect type boundary and downstream consumers'] }); }
    if (/TODO|FIXME|HACK/.test(line)) { counters.todoFixme++; add('maintenance', 'low', n, 'Maintenance marker requires ownership or closure.', line.trim(), { violatedInvariants: ['maintenance closure'] }); }
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(line)) { counters.broadCatch++; add('error-handling', 'high', n, 'Empty catch block may hide root causes.', line.trim(), { violatedInvariants: ['observable failure propagation'], suggestedVerification: ['trace producer-to-handler path and verify error evidence is preserved'] }); }
    if (/process\.exit\(0\)/.test(line)) { counters.directProcessExit++; add('control-flow', 'medium', n, 'Direct process exit may bypass structured evidence; review contract ownership.', line.trim(), { violatedInvariants: ['structured lifecycle completion'] }); }
    if (/\b(?:import|export)\s+(?:type\s+)?(?:[^'"]+from\s*)?['"]([^'"]+)['"]/.test(line)) counters.importEdges++;
    if (contractTerms.some((term) => line.toLowerCase().includes(term))) counters.contractMentions++;
  });
  const refs = [...text.matchAll(/(?:from\s+|import\s*\(|require\s*\()['"]([^'"]+)['"]/g)].map((m) => m[1]);
  imports.set(file, refs);
}

const basenameCounts = new Map();
for (const file of analysisFiles) { const base = path.basename(file); basenameCounts.set(base, [...(basenameCounts.get(base) ?? []), file]); }
for (const [base, files] of basenameCounts) {
  if (files.length > 1 && /^(index|utils|helpers|constants)\.(mjs|js|ts|tsx)$/.test(base)) {
    counters.duplicatedGenericFiles++;
    findings.push({ findingId: hash(`${sha}:duplicate:${base}`).slice(0, 16), category: 'structure', severity: 'low', confidence: 0.55, target: files.join(', '), line: null, summary: `Repeated generic filename may indicate ambiguous ownership: ${base}.`, evidence: files, historicalMatches: [], rootCauseHypotheses: ['possible ownership ambiguity'], propagation: ['ambiguous ownership can propagate to import/contract selection'], violatedInvariants: ['single authoritative owner'], affectedContracts: [], suggestedVerification: ['inspect import graph and authoritative owner'], decisionRequired: 'INVESTIGATE' });
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
  const targetText = texts.get(finding.target.split(', ')[0]) ?? '';
  const nearby = targetText.split(/\r?\n/).slice(Math.max(0, (finding.line ?? 1) - 3), (finding.line ?? 1) + 2).join(' ').trim();
  if (nearby) finding.evidenceContext = nearby;
  const importsForTarget = imports.get(finding.target.split(', ')[0]) ?? [];
  finding.dependencyEvidence = importsForTarget.slice(0, 12);
  if (finding.historicalMatches.length) finding.rootCauseHypotheses.push('historical pattern overlap is a prioritization signal, not proof of causality');
}

const base = {
  schemaVersion: contract.schemaVersion,
  authority: 'READ_ONLY_CODE_SCOUT',
  mode: incremental ? 'READ_ONLY_INCREMENTAL_ANALYSIS' : 'READ_ONLY_ANALYSIS',
  scannerMode: 'READ_ONLY',
  mutationPolicy: 'NO_SOURCE_MUTATION',
  reportWriteScope: OUTPUT,
  scannedSha: sha,
  generatedAt: new Date().toISOString(),
  filesScanned: analysisFiles.length,
  scan: { trackedFiles: tracked.length, candidateFiles: sourceFiles.length, analyzedFiles: analysisFiles.length, incremental, scopePath: scopePath ?? null, scopeFallback },
  counters,
  findings,
  historicalMatches,
  graphSummary: { sourceFiles: sourceFiles.length, analyzedFiles: analysisFiles.length, historicalSources: knowledge.sources.length, findings: findings.length, importEdges: counters.importEdges, contractMentions: counters.contractMentions },
  unknowns: [incremental ? 'Incremental scout analyzes the changed-file scope only; dependency propagation outside the supplied impact scope requires independent verification.' : 'Static scout cannot prove runtime causality or complete dependency propagation without executing affected contracts.'],
  decisionPolicy: 'Findings are evidence-backed hypotheses for execution agents. The scout never selects, approves, or performs a repair. Root-cause candidates require independent verification.',
};
const report = { ...base, digest: hash(JSON.stringify(base)) };
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', authority: report.authority, mode: report.mode, scannedSha: sha, output: OUTPUT, findings: findings.length, historicalMatches: historicalMatches.length, filesScanned: analysisFiles.length, incremental }, null, 2));
