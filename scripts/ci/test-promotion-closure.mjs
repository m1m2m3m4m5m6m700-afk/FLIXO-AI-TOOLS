#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-promotion-'));
const sha = 'a'.repeat(40);
const runs = [
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
].map((name) => ({ name, status: 'completed', conclusion: 'success', headSha: sha, updatedAt: '2026-09-20T00:00:00Z' }));
const status = { statuses: [{ context: 'internal', state: 'success' }] };
const checks = [{ check_runs: [{ name: 'Certification', status: 'completed', conclusion: 'success', completed_at: '2026-09-20T00:01:00Z' }] }];
const write = (name, value) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
};
const runsPath = write('runs.json', runs);
const statusPath = write('status.json', status);
const checksPath = write('checks.json', checks);
const livePath = write('live.json', {
  state: 'UNVERIFIED',
  verifiedSha: sha,
  evidenceRef: 'none',
  verifier: 'test',
  verifiedAt: '2026-09-20T00:00:00Z',
  provider: 'supabase',
});
const outputPath = path.join(dir, 'evidence.json');
const script = path.resolve('scripts/ci/validate-promotion-closure.mjs');

let p = spawnSync(process.execPath, [script], {
  env: { ...process.env, EXPECTED_SHA: sha, EXACT_RUNS_PATH: runsPath, EXACT_STATUS_PATH: statusPath, EXACT_CHECKS_PATH: checksPath, LIVE_RUNTIME_EVIDENCE_PATH: livePath, EVIDENCE_OUTPUT_PATH: outputPath },
  encoding: 'utf8',
});
assert.notEqual(p.status, 0);
assert.match(p.stdout, /LIVE_RUNTIME_STATE=UNVERIFIED/u);

const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
live.state = 'LIVE_VERIFIED';
live.evidenceRef = 'runtime-readback:example';
fs.writeFileSync(livePath, JSON.stringify(live));

p = spawnSync(process.execPath, [script], {
  env: { ...process.env, EXPECTED_SHA: sha, EXACT_RUNS_PATH: runsPath, EXACT_STATUS_PATH: statusPath, EXACT_CHECKS_PATH: checksPath, LIVE_RUNTIME_EVIDENCE_PATH: livePath, EVIDENCE_OUTPUT_PATH: outputPath },
  encoding: 'utf8',
});
assert.equal(p.status, 0, p.stdout + p.stderr);
const evidence = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.equal(evidence.state, 'CERTIFIABLE');
console.log('PROMOTION_CLOSURE_TEST=PASS');
