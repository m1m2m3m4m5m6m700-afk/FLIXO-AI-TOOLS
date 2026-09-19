#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const auditPath = resolve(ROOT, 'diagnostics/ci/technical-debt-audit.json');
const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const producer = spawnSync(process.execPath, ['scripts/ci/audit-technical-debt.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.equal(producer.status, 0, `technical-debt audit producer must exit cleanly: ${producer.stderr}`);
assert.equal(producer.stderr, '', 'technical-debt audit producer must not emit diagnostic errors');

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
assert.equal(audit.inventory.genericPlaywrightHarness, true, 'generic Playwright harness must be recognized for test ownership');
assert.equal(audit.findings.some((finding) => finding.target === 'tests/foundation.spec.ts' && finding.id === 'RC-DEBT-ORPHAN-TEST-CANDIDATE'), false, 'Playwright-owned spec must not be classified as orphaned');
assert.equal(audit.findings.some((finding) => finding.target === 'artifacts/ci/legacy-inventory.json'), false, 'historical evidence must not be classified as legacy deletion debt');
for (const dependency of ['react', 'react-dom', '@playwright/test', 'vite']) {
  assert.equal(
    audit.findings.some((finding) => finding.id === 'RC-DEBT-UNREFERENCED-DEPENDENCY-CANDIDATE' && finding.target === dependency),
    false,
    `used dependency ${dependency} must not be classified as unreferenced`,
  );
}
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
