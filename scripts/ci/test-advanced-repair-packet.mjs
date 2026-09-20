import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-packet-'));
const file = path.join(dir, 'packet.json');
const valid = {
  schemaVersion: '1.0.0', repairChainId: 'chain-1', entrySha: 'a'.repeat(40),
  failureFingerprint: 'fp-1', evidence: { log: 'x' }, hypotheses: [{ id: 'h1' }],
  falsification: [{ hypothesisId: 'h1', result: 'not-falsified' }],
  scope: { allowedPaths: ['src/example.js'] },
  verification: { baseline: { status: 'red' }, postRepair: { status: 'green' }, decision: 'pending' },
  provenance: { source: 'ci', targetSha: 'a'.repeat(40) }, state: 'DIAGNOSED'
};
const run = () => spawnSync(process.execPath, ['scripts/ci/validate-advanced-repair-packet.mjs', file], { encoding: 'utf8' });
fs.writeFileSync(file, JSON.stringify(valid));
let result = run();
if (result.status !== 0) throw new Error(`valid packet rejected: ${result.stderr}`);
valid.provenance.targetSha = 'b'.repeat(40);
fs.writeFileSync(file, JSON.stringify(valid));
result = run();
if (result.status === 0 || !result.stderr.includes('PACKET_SHA_DRIFT')) throw new Error('SHA drift was not rejected');
console.log('advanced repair packet invariants: PASS');
