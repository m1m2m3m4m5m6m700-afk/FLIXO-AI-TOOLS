#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const auditPath = resolve(ROOT, 'diagnostics/ci/technical-debt-audit.json');
const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const output = execFileSync(process.execPath, ['scripts/ci/validate-technical-debt-audit.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});

assert.match(output, /TECHNICAL_DEBT_AUDIT_CONTRACT=PASS/);
assert.match(output, /TECHNICAL_DEBT_AUDIT_SHA=[a-f0-9]{40}/);
assert.match(output, /TECHNICAL_DEBT_FINDINGS=\d+/);
assert.match(output, /TECHNICAL_DEBT_AUDIT_DIGEST=[a-f0-9]{64}/);
assert.equal(existsSync(auditPath), true, 'technical-debt audit artifact must exist');

const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
assert.equal(audit.schema, 'flixo-technical-debt-audit/v3');
assert.equal(audit.sha, run(['rev-parse', 'HEAD']));
assert.equal(audit.findings.length, audit.summary.findings);
const fingerprints = audit.findings.map((finding) => finding.fingerprint);
assert.equal(new Set(fingerprints).size, fingerprints.length, 'finding fingerprints must be unique');
for (const fingerprint of fingerprints) assert.match(fingerprint, /^[a-f0-9]{64}$/);
for (const finding of audit.findings) {
  assert.ok(finding.evidence && typeof finding.evidence === 'object' && !Array.isArray(finding.evidence) && Object.keys(finding.evidence).length > 0, `finding ${finding.target} must carry evidence`);
}
assert.equal(typeof audit.auditDigest, 'string');
assert.match(audit.auditDigest, /^[a-f0-9]{64}$/);

console.log('TECHNICAL_DEBT_AUDIT_REGRESSION=PASS');
console.log(`TECHNICAL_DEBT_AUDIT_REGRESSION_SHA=${audit.sha}`);
