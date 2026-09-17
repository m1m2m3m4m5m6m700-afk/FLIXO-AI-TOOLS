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
assert.equal(audit.schema, 'flixo-technical-debt-audit/v4');
assert.equal(audit.sha, run(['rev-parse', 'HEAD']));
assert.equal(audit.findings.length, audit.summary.findings);
assert.equal(typeof audit.auditDigest, 'string');
assert.match(audit.auditDigest, /^[a-f0-9]{64}$/);
assert.ok(audit.findings.every((finding) => /^[A-F0-9]{16}$/.test(finding.fingerprint)), 'every finding must have a deterministic fingerprint');
assert.equal(new Set(audit.findings.map((finding) => finding.fingerprint)).size, audit.findings.length, 'finding fingerprints must be unique');

console.log('TECHNICAL_DEBT_AUDIT_REGRESSION=PASS');
console.log(`TECHNICAL_DEBT_AUDIT_REGRESSION_SHA=${audit.sha}`);
console.log(`TECHNICAL_DEBT_AUDIT_FINGERPRINTS=${audit.findings.length}`);
