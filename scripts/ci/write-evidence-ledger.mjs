import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const output = resolve(root, 'evidence/ci/evidence-ledger.json');
const gates = JSON.parse(process.env.FLIXO_EVIDENCE_GATES ?? '[]');

if (!Array.isArray(gates) || gates.length === 0) {
  console.error('Evidence ledger requires a non-empty gate list.');
  process.exit(1);
}

const normalized = gates.map((gate) => ({
  gate: String(gate.gate),
  owner: String(gate.owner),
  result: String(gate.result),
}));

const skipped = normalized.filter((gate) => gate.result === 'skipped').length;
const missing = normalized.filter((gate) => !gate.result || gate.result === 'unknown').length;
const failed = normalized.filter((gate) => gate.result !== 'success').length;
const executed = normalized.filter((gate) => gate.result !== 'skipped' && gate.result !== 'unknown' && Boolean(gate.result)).length;
const expected = normalized.length;
const passed = normalized.filter((gate) => gate.result === 'success').length;
const pass = expected === executed && failed === 0 && skipped === 0 && missing === 0;

const ledger = {
  schema: 'flixo.evidence-ledger.v1',
  sha: process.env.GITHUB_SHA ?? 'unknown',
  run_id: process.env.GITHUB_RUN_ID ?? 'unknown',
  workflow: process.env.GITHUB_WORKFLOW ?? 'unknown',
  event: process.env.GITHUB_EVENT_NAME ?? 'unknown',
  created_at: new Date().toISOString(),
  expected,
  executed,
  passed,
  failed,
  skipped,
  missing,
  result: pass ? 'PASS' : 'FAIL',
  gates: normalized,
};

mkdirSync(resolve(root, 'evidence/ci'), { recursive: true });
writeFileSync(output, `${JSON.stringify(ledger, null, 2)}\\n`);
console.log(JSON.stringify(ledger, null, 2));
if (!pass) process.exit(1);
