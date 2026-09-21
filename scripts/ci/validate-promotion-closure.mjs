#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const expectedSha = process.env.EXPECTED_SHA || '';
const runsPath = process.env.EXACT_RUNS_PATH || '/tmp/exact-runs.json';
const statusPath = process.env.EXACT_STATUS_PATH || '/tmp/exact-status.json';
const checksPath = process.env.EXACT_CHECKS_PATH || '/tmp/exact-check-runs.json';
const livePath = process.env.LIVE_RUNTIME_EVIDENCE_PATH || 'docs/runtime/council-live-runtime-evidence.json';
const outputPath = process.env.EVIDENCE_OUTPUT_PATH || '/tmp/flixo-promotion-evidence.json';

const requiredWorkflows = [
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
];

const failures = [];
const readJson = (file, label) => {
  if (!fs.existsSync(file)) {
    failures.push(`MISSING_${label}=${file}`);
    return null;
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { failures.push(`INVALID_${label}=${file}`); return null; }
};

if (!/^[0-9a-f]{40}$/u.test(expectedSha)) failures.push('EXPECTED_SHA_INVALID');

const runs = readJson(runsPath, 'EXACT_RUNS');
if (Array.isArray(runs)) {
  for (const name of requiredWorkflows) {
    const current = runs
      .filter((run) => run?.name === name)
      .sort((a, b) => String(a?.updatedAt ?? '').localeCompare(String(b?.updatedAt ?? '')))
      .at(-1);
    if (!current) {
      failures.push(`WORKFLOW_MISSING=${name}`);
      continue;
    }
    if (current.headSha !== expectedSha) failures.push(`WORKFLOW_SHA_DRIFT=${name}:${current.headSha}`);
    if (current.status !== 'completed' || current.conclusion !== 'success') {
      failures.push(`WORKFLOW_NOT_GREEN=${name}:${current.status}:${current.conclusion}`);
    }
  }
}

const status = readJson(statusPath, 'COMMIT_STATUS');
if (status?.statuses) {
  for (const item of status.statuses) {
    if (item?.context !== 'Vercel' && item?.state !== 'success') {
      failures.push(`COMMIT_STATUS_NOT_GREEN=${item?.context}:${item?.state}`);
    }
  }
}

const checks = readJson(checksPath, 'CHECK_RUNS');
const checkRuns = Array.isArray(checks) ? checks.flatMap((page) => page?.check_runs ?? []) : [];
const certification = checkRuns
  .filter((run) => run?.name === 'Certification')
  .sort((a, b) => String(a?.completed_at ?? a?.started_at ?? '').localeCompare(String(b?.completed_at ?? b?.started_at ?? '')))
  .at(-1);
if (!certification) failures.push('CERTIFICATION_MISSING');
else if (certification.status !== 'completed' || certification.conclusion !== 'success') failures.push('CERTIFICATION_NOT_GREEN');

const live = readJson(livePath, 'LIVE_RUNTIME_EVIDENCE');
if (!live) {
  failures.push('LIVE_RUNTIME_NOT_VERIFIED');
} else {
  if (live.state !== 'LIVE_VERIFIED') failures.push(`LIVE_RUNTIME_STATE=${live.state}`);
  if (live.verifiedSha !== expectedSha) failures.push(`LIVE_RUNTIME_SHA_DRIFT=${live.verifiedSha}`);
  if (!String(live.evidenceRef ?? '').trim()) failures.push('LIVE_RUNTIME_EVIDENCE_REF_MISSING');
  if (!String(live.verifier ?? '').trim()) failures.push('LIVE_RUNTIME_VERIFIER_MISSING');
  if (Number.isNaN(Date.parse(String(live.verifiedAt ?? '')))) failures.push('LIVE_RUNTIME_VERIFIED_AT_INVALID');
  if (!String(live.provider ?? '').trim()) failures.push('LIVE_RUNTIME_PROVIDER_MISSING');
}

const evidence = {
  schemaVersion: 1,
  authority: 'FLIXO_EXACT_SHA_PROMOTION_EVIDENCE',
  state: failures.length ? 'BLOCKED' : 'CERTIFIABLE',
  exactSha: expectedSha,
  generatedAt: new Date().toISOString(),
  requiredWorkflows,
  workflowEvidencePath: runsPath,
  commitStatusEvidencePath: statusPath,
  certificationEvidencePath: checksPath,
  liveRuntimeEvidencePath: livePath,
  liveRuntimeState: live?.state ?? 'UNVERIFIED',
  failures,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
if (failures.length) process.exit(1);
