#!/usr/bin/env node

const repository = (process.env.GITHUB_REPOSITORY ?? '').trim();
const token = (process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim();
const branch = 'execution';
import fs from 'node:fs/promises';

const graceDays = Number.parseInt(process.env.FLIXO_STALE_EXECUTION_GRACE_DAYS ?? '14', 10);

if (!/^[^/]+\/[^/]+$/.test(repository) || !token) {
  console.error('FAIL CLOSED: repository/token identity missing for latest-execution cleanup.');
  process.exit(1);
}
if (!Number.isInteger(graceDays) || graceDays < 1 || graceDays > 365) {
  console.error('FAIL CLOSED: invalid FLIXO_STALE_EXECUTION_GRACE_DAYS.');
  process.exit(1);
}

const apiBase = 'https://api.github.com';
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'x-github-api-version': '2022-11-28',
  'user-agent': 'FLIXO-latest-execution-head-cleanup',
  'content-type': 'application/json',
};

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {...headers, ...(options.headers ?? {})},
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${path}: ${text.slice(0, 500)}`);
  }
  return body;
}

async function listAll(path, key) {
  const rows = [];
  for (let page = 1; page <= 100; page += 1) {
    const body = await github(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const pageRows = Array.isArray(body?.[key]) ? body[key] : [];
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return rows;
}

async function resolveExecutionHead() {
  const body = await github(`/repos/${repository}/git/ref/heads/${branch}`);
  const sha = String(body?.object?.sha ?? '').trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('FAIL CLOSED: execution ref did not return a valid SHA.');
  return sha;
}

const cutoff = Date.now() - graceDays * 24 * 60 * 60 * 1000;
const latestSha = await resolveExecutionHead();
console.log(`LATEST_EXECUTION_HEAD=${latestSha}`);
console.log(`STALE_EXECUTION_GRACE_DAYS=${graceDays}`);

const runs = await listAll(`/repos/${repository}/actions/runs?branch=${branch}`, 'workflow_runs');
let cancelled = 0;
let deletedRuns = 0;
const summary = { schemaVersion: 1, ruleId: 'LATEST-EXECUTION-HEAD-ONLY-001', repository, branch, latestExecutionSha: latestSha, graceDays, cancelledRuns: [], deletedRuns: [], deletedArtifacts: [] };

for (const run of runs) {
  const runId = Number(run?.id);
  const headSha = String(run?.head_sha ?? '');
  const headBranch = String(run?.head_branch ?? '');
  const headRepository = String(run?.head_repository?.full_name ?? '');
  const status = String(run?.status ?? '');
  const updatedAt = Date.parse(String(run?.updated_at ?? ''));
  const name = String(run?.name ?? '');

  if (!Number.isInteger(runId) || headBranch !== branch || headRepository !== repository) continue;
  if (headSha === latestSha) continue;

  if (status !== 'completed') {
    await github(`/repos/${repository}/actions/runs/${runId}/cancel`, {method: 'POST'});
    cancelled += 1;
    summary.cancelledRuns.push({id: runId, sha: headSha, name});
    console.log(`STALE_RUN_CANCELLED id=${runId} sha=${headSha} name=${name}`);
    continue;
  }

  if (!Number.isFinite(updatedAt) || updatedAt >= cutoff) continue;
  await github(`/repos/${repository}/actions/runs/${runId}`, {method: 'DELETE'});
  deletedRuns += 1;
  summary.deletedRuns.push({id: runId, sha: headSha, name});
  console.log(`STALE_RUN_DELETED id=${runId} sha=${headSha} name=${name}`);
}

const artifacts = await listAll(`/repos/${repository}/actions/artifacts`, 'artifacts');
let deletedArtifacts = 0;

for (const artifact of artifacts) {
  const artifactId = Number(artifact?.id);
  const workflowRun = artifact?.workflow_run ?? {};
  const headSha = String(workflowRun?.head_sha ?? '');
  const headBranch = String(workflowRun?.head_branch ?? '');
  const headRepository = String(workflowRun?.head_repository?.full_name ?? '');
  const createdAt = Date.parse(String(artifact?.created_at ?? ''));

  if (!Number.isInteger(artifactId) || headBranch !== branch || headRepository !== repository) continue;
  if (!headSha || headSha === latestSha) continue;
  if (!Number.isFinite(createdAt) || createdAt >= cutoff) continue;

  await github(`/repos/${repository}/actions/artifacts/${artifactId}`, {method: 'DELETE'});
  deletedArtifacts += 1;
  summary.deletedArtifacts.push({id: artifactId, sha: headSha, name: String(artifact?.name ?? '')});
  console.log(`STALE_ARTIFACT_DELETED id=${artifactId} sha=${headSha} name=${String(artifact?.name ?? '')}`);
}

const finalSha = await resolveExecutionHead();
if (finalSha !== latestSha) {
  console.error(`FAIL CLOSED: execution advanced during cleanup old=${latestSha} new=${finalSha}`);
  process.exit(1);
}

summary.finishedAt = new Date().toISOString();
await fs.writeFile('/tmp/latest-execution-head-cleanup-summary.json', JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(`STALE_EXECUTION_RUNS_CANCELLED=${cancelled}`);
console.log(`STALE_EXECUTION_RUNS_DELETED=${deletedRuns}`);
console.log(`STALE_EXECUTION_ARTIFACTS_DELETED=${deletedArtifacts}`);
console.log('LATEST_EXECUTION_HEAD_ONLY_CLEANUP=PASS');
