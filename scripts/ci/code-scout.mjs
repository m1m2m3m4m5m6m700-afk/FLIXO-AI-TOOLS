#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const KNOWLEDGE = path.join(ROOT, 'docs/ci/investigation/HISTORICAL-KNOWLEDGE-BASE.json');
const CONTRACT = path.join(ROOT, 'docs/ci/investigation/INVESTIGATION-REPORT-CONTRACT.json');
const OUT = path.join(ROOT, 'diagnostics/investigation/code-scout-latest.json');
const EXCLUDED = /^(?:\.git|node_modules|dist|coverage|\.cache|\.vite)(?:\/|$)|(?:^|\/)(?:\.env(?:\.|$)|.*\.(?:pem|key))$/u;
const TEXT = new Set(['.ts','.tsx','.js','.mjs','.cjs','.json','.md','.mdx','.yml','.yaml','.toml','.sql','.sh','.css','.scss','.html']);
const sha = execFileSync('git', ['rev-parse','HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const files = execFileSync('git', ['ls-files','-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean).filter((f) => !EXCLUDED.test(f) && (TEXT.has(path.extname(f).toLowerCase()) || path.basename(f).startsWith('.')));
const knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE, 'utf8'));
const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));

const findings = [];
const text = new Map();
for (const file of files) {
  try { text.set(file, fs.readFileSync(path.join(ROOT, file), 'utf8')); } catch {}
}
const all = [...text.entries()].map(([file, content]) => `${file}\n${content}`).join('\n');
const add = (id, category, severity, target, evidence, hypotheses, contracts, verification, decision, confidence = 0.8) => findings.push({ findingId:id, category, severity, confidence, target, evidence, historicalMatches:[], rootCauseHypotheses:hypotheses, affectedContracts:contracts, suggestedVerification:verification, decisionRequired:decision });

if (text.has('package.json')) {
  const pkg = JSON.parse(text.get('package.json'));
  if (!pkg.scripts?.['test:static']) add('SCOUT-001','contract-drift','HIGH','package.json',['test:static script is absent'],['verification ownership may be fragmented'],['static-verification'],['inspect CI and package verification ownership'],'ESCALATE',0.95);
}
const markers = [
  ['SCOUT-002','hardcoded-ui','MEDIUM','hardcoded UI-like strings in executable source',/['"`](?:Save|Cancel|Upload|Download|Error|Success|Loading)['"`]/u,'i18n contracts'],
  ['SCOUT-003','contract-drift','MEDIUM','duplicate fallback ownership',/DEFAULT_[A-Z0-9_]*(?:UI|TRANSLATION)|fallback.*translation/iu,'i18n runtime'],
  ['SCOUT-004','diagnostics','LOW','generated evidence committed as source',/diagnostics\/(?:.*)\.json/iu,'evidence lifecycle']
];
for (const [id, category, severity, target, re, contractName] of markers) {
  const hits = [...text.entries()].filter(([file, content]) => !file.startsWith('docs/ci/investigation/') && re.test(content)).map(([file]) => file).slice(0, 12);
  if (hits.length) add(id, category, severity, target, hits, [`pattern detected; causality requires execution-agent verification`],[contractName],['inspect exact occurrences and owning contract'],'INVESTIGATE',0.65);
}

for (const source of knowledge.sources) {
  const exists = text.has(source.historicalFile);
  if (!exists) continue;
  const matched = source.patterns.filter((p) => all.toLowerCase().includes(String(p).toLowerCase().slice(0, Math.min(80, String(p).length))));
  if (matched.length) {
    for (const f of findings) if (f.historicalMatches.length < 4 && matched.some((m) => f.evidence.join(' ').toLowerCase().includes(String(m).toLowerCase().slice(0, 30)))) f.historicalMatches.push({ source: source.id, patterns: matched.slice(0,3) });
  }
}

const reportBase = { schemaVersion: contract.schemaVersion, scannedSha: sha, generatedAt: new Date().toISOString(), scannerMode:'READ_ONLY', filesScanned:files.length, findings, historicalMatches:knowledge.sources.map((s) => ({ id:s.id, historicalFile:s.historicalFile ?? null, sourceCommit:s.sourceCommit ?? null, recoveredPatterns:s.patterns.length })), graphSummary:{ textFiles:files.length, historicalSources:knowledge.sources.length, findingCount:findings.length }, unknowns:[] };
const digest = crypto.createHash('sha256').update(JSON.stringify(reportBase), 'utf8').digest('hex');
const report = { ...reportBase, digest };
fs.mkdirSync(path.dirname(OUT), { recursive:true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status:'GENERATED', mode:'READ_ONLY', scannedSha:sha, filesScanned:files.length, findings:findings.length, historicalSources:knowledge.sources.length, output:OUT }, null, 2));
