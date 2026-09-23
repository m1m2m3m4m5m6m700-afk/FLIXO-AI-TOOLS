#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const expectedSha = process.env.EXPECTED_SHA || '';
const runsPath = process.env.EXACT_RUNS_PATH || '/tmp/exact-runs.json';
const statusPath = process.env.EXACT_STATUS_PATH || '/tmp/exact-status.json';
const checksPath = process.env.EXACT_CHECKS_PATH || '/tmp/exact-check-runs.json';
const livePath = process.env.LIVE_RUNTIME_EVIDENCE_PATH || 'docs/runtime/council-live-runtime-evidence.json';\nconst vercelPath = process.env.VERCEL_DEPLOYMENT_EVIDENCE_PATH || 'docs/runtime/vercel-deployment-evidence.json';
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
const canonicalTestRun = Array.isArray(runs)
  ? runs
    .filter((run) =>
      run?.name === 'FLIXO Test System' &&
      run?.headSha === expectedSha &&
      run?.status === 'completed' &&
      run?.conclusion === 'success'
    )
    .sort((a, b) => String(a?.updatedAt ?? '').localeCompare(String(b?.updatedAt ?? '')))
    .at(-1) ?? null
  : null;
if (!canonicalTestRun) failures.push('CANONICAL_TEST_SYSTEM_RUN_MISSING');

const actionRunIdOfCheck = (check) => {
  const detailsUrl = String(check?.details_url ?? '');
  const match = detailsUrl.match(/\/actions\/runs\/(\d+)(?:\/job\/\d+)?(?:[/?#]|$)/u);
  return match?.[1] ?? null;
};
const certification = checkRuns
  .filter((run) =>
    run?.name === 'Certification' &&
    run?.status === 'completed' &&
    run?.conclusion === 'success' &&
    run?.head_sha === expectedSha &&
    actionRunIdOfCheck(run) !== null &&
    canonicalTestRun?.databaseId != null &&
    actionRunIdOfCheck(run) === String(canonicalTestRun.databaseId)
  )
  .sort((a, b) => String(a?.completed_at ?? a?.started_at ?? '').localeCompare(String(b?.completed_at ?? b?.started_at ?? '')))
  .at(-1);
if (!certification) failures.push('CERTIFICATION_MISSING_OR_NONCANONICAL');

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

const vercel = readJson(vercelPath, 'VERCEL_DEPLOYMENT_EVIDENCE');
if (!vercel) {
  failures.push('VERCEL_DEPLOYMENT_EVIDENCE_MISSING');
} else {
  if (vercel.provider !== 'vercel') failures.push(`VERCEL_DEPLOYMENT_PROVIDER_INVALID=${vercel.provider}`);
  if (vercel.state !== 'LIVE_VERIFIED') failures.push(`VERCEL_DEPLOYMENT_STATE=${vercel.state}`);
  if (vercel.gitSha !== expectedSha) failures.push(`VERCEL_DEPLOYMENT_SHA_DRIFT=${vercel.gitSha}`);
  if (!String(vercel.url ?? '').trim()) failures.push('VERCEL_DEPLOYMENT_URL_MISSING');
  if (Number.isNaN(Date.parse(String(vercel.verifiedAt ?? '')))) failures.push('VERCEL_DEPLOYMENT_VERIFIED_AT_INVALID');
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
