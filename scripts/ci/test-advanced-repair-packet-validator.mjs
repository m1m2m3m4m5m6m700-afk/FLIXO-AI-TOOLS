import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-packet-'));
const file = path.join(dir, 'packet.json');
const valid = {
  schemaVersion: '1.0.0', repairChainId: 'chain-1',
  entrySha: '0123456789abcdef0123456789abcdef01234567',
  failureFingerprint: 'failure-1', evidence: [{ source: 'ci', id: 'run-1' }],
  hypotheses: [{ id: 'h1', status: 'confirmed' }],
  falsification: [{ id: 'f1', result: 'passed' }],
  scope: { allowedPaths: ['scripts/ci/example.mjs'] },
  verification: { baseline: 'failed', postRepair: 'passed', decision: 'approved' },
  provenance: { source: 'github-actions', targetSha: '0123456789abcdef0123456789abcdef01234567' },
  state: 'READY_FOR_PLAN'
};
const validator = path.resolve('scripts/ci/validate-advanced-repair-packet.mjs');
fs.writeFileSync(file, JSON.stringify(valid));
execFileSync(process.execPath, [validator, file], { stdio: 'pipe' });
const drifted = { ...valid, provenance: { ...valid.provenance, targetSha: 'fedcba9876543210fedcba9876543210fedcba98' } };
fs.writeFileSync(file, JSON.stringify(drifted));
let rejected = false;
try { execFileSync(process.execPath, [validator, file], { stdio: 'pipe' }); } catch (error) { rejected = /PACKET_SHA_DRIFT/.test(String(error.stderr)); }
if (!rejected) throw new Error('NEGATIVE_CONTROL_SHA_DRIFT_NOT_REJECTED');
console.log('advanced repair packet validator: PASS');
