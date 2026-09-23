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
].map((name, index) => ({
  name,
  databaseId: index === 0 ? 77 : index + 1,
  status: 'completed',
  conclusion: 'success',
  headSha: sha,
  updatedAt: '2026-09-20T00:00:00Z',
}));
const status = { statuses: [{ context: 'internal', state: 'success' }] };
const checks = [{
  check_runs: [{
    name: 'Certification',
    status: 'completed',
    conclusion: 'success',
    head_sha: sha,
    details_url: 'https://github.com/m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS/actions/runs/77/job/7700',
    completed_at: '2026-09-20T00:01:00Z',
  }],
}];
const write = (name, value) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
};
const runsPath = write('runs.json', runs);
const statusPath = write('status.json', status);
const checksPath = write('checks.json', checks);
const vercelPath = write('vercel.json', { provider: 'vercel', state: 'LIVE_VERIFIED', gitSha: sha, url: 'https://flixoai.vercel.app', verifiedAt: '2026-09-20T00:00:00Z' });
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
const autoRepairWorkflow = fs.readFileSync(path.resolve('.github/workflows/auto-repair.yml'), 'utf8');
assert.doesNotMatch(autoRepairWorkflow, /ACTION-REPAIR-TWO-COMMITS|ACTION_REPAIR_TWO_COMMITS|SECOND_SHA/u);
assert.match(autoRepairWorkflow, /ACTION_REPAIR_SINGLE_COMMIT=PASS/u);
assert.match(autoRepairWorkflow, /rev-list --count \"\\$FAILED_SHA\"\.\.\\$EXECUTION_SHA/u);

let p = spawnSync(process.execPath, [script], {
  env: { ...process.env, EXPECTED_SHA: sha, EXACT_RUNS_PATH: runsPath, EXACT_STATUS_PATH: statusPath, EXACT_CHECKS_PATH: checksPath, LIVE_RUNTIME_EVIDENCE_PATH: livePath, VERCEL_DEPLOYMENT_EVIDENCE_PATH: vercelPath, EVIDENCE_OUTPUT_PATH: outputPath },
  encoding: 'utf8',
});
assert.notEqual(p.status, 0);
assert.match(p.stdout, /LIVE_RUNTIME_STATE=UNVERIFIED/u);

const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
live.state = 'LIVE_VERIFIED';
live.evidenceRef = 'runtime-readback:example';
fs.writeFileSync(livePath, JSON.stringify(live));

p = spawnSync(process.execPath, [script], {
  env: { ...process.env, EXPECTED_SHA: sha, EXACT_RUNS_PATH: runsPath, EXACT_STATUS_PATH: statusPath, EXACT_CHECKS_PATH: checksPath, LIVE_RUNTIME_EVIDENCE_PATH: livePath, VERCEL_DEPLOYMENT_EVIDENCE_PATH: vercelPath, EVIDENCE_OUTPUT_PATH: outputPath },
  encoding: 'utf8',
});
assert.equal(p.status, 0, p.stdout + p.stderr);
const evidence = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.equal(evidence.state, 'CERTIFIABLE');

const spoofedChecks = [{
  check_runs: [{
    name: 'Certification',
    status: 'completed',
    conclusion: 'success',
    head_sha: sha,
    details_url: 'https://github.com/m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS/actions/runs/999/job/9999',
    completed_at: '2026-09-20T00:02:00Z',
  }],
}];
const spoofedChecksPath = write('spoofed-checks.json', spoofedChecks);
p = spawnSync(process.execPath, [script], {
  env: { ...process.env, EXPECTED_SHA: sha, EXACT_RUNS_PATH: runsPath, EXACT_STATUS_PATH: statusPath, EXACT_CHECKS_PATH: spoofedChecksPath, LIVE_RUNTIME_EVIDENCE_PATH: livePath, EVIDENCE_OUTPUT_PATH: outputPath },
  encoding: 'utf8',
});
assert.notEqual(p.status, 0);
assert.match(p.stdout, /CERTIFICATION_MISSING/u);

const missingLinkChecks = [{
  check_runs: [{
    name: 'Certification',
    status: 'completed',
    conclusion: 'success',
    head_sha: sha,
    completed_at: '2026-09-20T00:03:00Z',
  }],
}];
const missingLinkChecksPath = write('missing-link-checks.json', missingLinkChecks);
p = spawnSync(process.execPath, [script], {
  env: { ...process.env, EXPECTED_SHA: sha, EXACT_RUNS_PATH: runsPath, EXACT_STATUS_PATH: statusPath, EXACT_CHECKS_PATH: missingLinkChecksPath, LIVE_RUNTIME_EVIDENCE_PATH: livePath, EVIDENCE_OUTPUT_PATH: outputPath },
  encoding: 'utf8',
});
assert.notEqual(p.status, 0);
assert.match(p.stdout, /CERTIFICATION_MISSING/u);

console.log('PROMOTION_CLOSURE_TEST=PASS');