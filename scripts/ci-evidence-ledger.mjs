import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('diagnostics', { recursive: true });
const specs = (process.env.CI_EVIDENCE_SPECS || '').split(',').map((x) => x.trim()).filter(Boolean);
const gates = specs.map((name) => ({ name, result: process.env[`CI_RESULT_${name.replace(/[^A-Za-z0-9]/g, '_')}`] || 'unknown' }));
const failed = gates.filter((gate) => gate.result !== 'success');
const skipped = gates.filter((gate) => gate.result === 'skipped');
const missing = gates.filter((gate) => gate.result === 'unknown');
const ledger = {
  version: 1,
  sha: process.env.GITHUB_SHA || 'unknown',
  generatedAt: new Date().toISOString(),
  gates,
  expected: gates.length,
  executed: gates.filter((gate) => gate.result !== 'skipped' && gate.result !== 'unknown').length,
  failed: failed.length,
  skipped: skipped.length,
  missing: missing.length,
  exactShaMatch: process.env.CI_EXPECTED_SHA ? process.env.CI_EXPECTED_SHA === process.env.GITHUB_SHA : true,
};

if (!ledger.exactShaMatch || ledger.failed !== 0 || ledger.skipped !== 0 || ledger.missing !== 0 || ledger.executed !== ledger.expected) {
  writeFileSync('diagnostics/ci-evidence-ledger.json', `${JSON.stringify(ledger, null, 2)}\n`);
  console.error(JSON.stringify(ledger, null, 2));
  process.exit(1);
}

writeFileSync('diagnostics/ci-evidence-ledger.json', `${JSON.stringify(ledger, null, 2)}\n`);
console.log(JSON.stringify(ledger, null, 2));
