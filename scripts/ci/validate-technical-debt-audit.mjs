#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const auditPath = resolve(ROOT, 'diagnostics/ci/technical-debt-audit.json');

const fail = (message) => {
  console.error(`TECHNICAL_DEBT_AUDIT_CONTRACT_ERROR=${message}`);
  process.exit(1);
};

const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

try {
  execFileSync(process.execPath, ['scripts/ci/audit-technical-debt.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
} catch {
  fail('audit-producer-failed');
}

if (!existsSync(auditPath)) fail('audit-output-missing');

let audit;
try {
  audit = JSON.parse(readFileSync(auditPath, 'utf8'));
} catch {
  fail('audit-output-invalid-json');
}

if (audit?.schema !== 'flixo-technical-debt-audit/v3') fail('schema-mismatch');
if (!/^\d{4}-\d{2}-\d{2}T/.test(String(audit?.generatedAt ?? ''))) fail('generatedAt-missing');

const headSha = run(['rev-parse', 'HEAD']);
if (audit?.sha !== headSha) fail(`sha-mismatch:${audit?.sha ?? 'missing'}:${headSha}`);

if (!audit?.inventory || typeof audit.inventory !== 'object') fail('inventory-missing');
if (!audit?.summary || typeof audit.summary !== 'object') fail('summary-missing');
if (!Array.isArray(audit?.findings)) fail('findings-not-array');
if (!audit?.auditDigest || !/^[a-f0-9]{64}$/.test(audit.auditDigest)) fail('auditDigest-invalid');

const requiredFindingKeys = ['id', 'fingerprint', 'category', 'severity', 'status', 'target', 'summary', 'evidence', 'action'];
const fingerprints = new Set();
const recomputeFindingFingerprint = (finding) => createHash('sha256').update(JSON.stringify({
  id: finding.id, category: finding.category, severity: finding.severity, target: finding.target,
  summary: finding.summary, action: finding.action,
}), 'utf8').digest('hex');
for (const [index, finding] of audit.findings.entries()) {
  if (!finding || typeof finding !== 'object') fail(`finding-${index}-not-object`);
  for (const key of requiredFindingKeys) {
    if (!(key in finding)) fail(`finding-${index}-missing-${key}`);
  }
  if (!/^[a-f0-9]{64}$/.test(finding.fingerprint)) fail(`finding-${index}-fingerprint-invalid`);
  if (finding.fingerprint !== recomputeFindingFingerprint(finding)) fail(`finding-${index}-fingerprint-mismatch`);
  if (!finding.target || typeof finding.target !== 'string') fail(`finding-${index}-target-invalid`);
  if (!finding.summary || typeof finding.summary !== 'string') fail(`finding-${index}-summary-invalid`);
  if (!finding.evidence || typeof finding.evidence !== 'object' || Array.isArray(finding.evidence) || Object.keys(finding.evidence).length === 0) fail(`finding-${index}-evidence-incomplete`);
  if (fingerprints.has(finding.fingerprint)) fail(`finding-${index}-fingerprint-duplicate`);
  fingerprints.add(finding.fingerprint);
}

const recomputed = { ...audit };
delete recomputed.auditDigest;
const expectedDigest = createHash('sha256').update(JSON.stringify(recomputed)).digest('hex');
if (audit.auditDigest !== expectedDigest) fail('auditDigest-mismatch');

const summaryCounts = {
  findings: audit.findings.length,
  deletionCandidates: audit.findings.filter((x) => /DELETE|REMOVE/.test(x.action)).length,
  modificationCandidates: audit.findings.filter((x) => x.action?.startsWith('MODIFY')).length,
  unproven: audit.findings.filter((x) => x.status === 'UNPROVEN').length,
  directCiBlockers: audit.findings.filter((x) => x.category === 'CI' && /HIGH|CRITICAL/.test(x.severity)).length,
  latentCiDebt: audit.findings.filter((x) => x.category === 'CI').length,
  nonCiTechnicalDebt: audit.findings.filter((x) => x.category !== 'CI').length,
};

for (const [key, value] of Object.entries(summaryCounts)) {
  if (audit.summary[key] !== value) fail(`summary-mismatch:${key}`);
}

console.log(`TECHNICAL_DEBT_AUDIT_CONTRACT=PASS`);
console.log(`TECHNICAL_DEBT_AUDIT_SHA=${headSha}`);
console.log(`TECHNICAL_DEBT_FINDINGS=${audit.findings.length}`);
console.log(`TECHNICAL_DEBT_AUDIT_DIGEST=${audit.auditDigest}`);
