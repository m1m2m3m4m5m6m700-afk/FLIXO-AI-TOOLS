#!/usr/bin/env node

import fs from 'node:fs';

const eventPath = (process.env.GITHUB_EVENT_PATH ?? '').trim();
const repository = (process.env.GITHUB_REPOSITORY ?? '').trim();
const token = (process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim();
const runId = (process.env.GITHUB_RUN_ID ?? '').trim();

if (!eventPath || !repository || !token || !runId) {
  console.error('FAIL CLOSED: workflow_run source guard requires GITHUB_EVENT_PATH, GITHUB_REPOSITORY, GITHUB_RUN_ID and GH_TOKEN/GITHUB_TOKEN.');
  process.exit(1);
}

let event;
try {
  event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
} catch (error) {
  console.error('FAIL CLOSED: unable to parse GITHUB_EVENT_PATH.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const sourceRun = event?.workflow_run;
if (!sourceRun || typeof sourceRun !== 'object') {
  console.error('FAIL CLOSED: workflow_run payload is missing.');
  process.exit(1);
}

const sourceSha = String(sourceRun.head_sha ?? '').trim().toLowerCase();
const sourceBranch = String(sourceRun.head_branch ?? '').trim();
const sourceRepository = String(sourceRun.head_repository?.full_name ?? repository).trim();

if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
  console.error('FAIL CLOSED: workflow_run source SHA is missing or malformed.');
  process.exit(1);
}
if (!/^[^/]+\/[^/]+$/u.test(sourceRepository) || sourceRepository !== repository) {
  console.error('FAIL CLOSED: workflow_run source repository is outside the canonical repository.');
  process.exit(1);
}
if (sourceBranch !== 'execution' && sourceBranch !== 'main') {
  console.error('FAIL CLOSED: workflow_run source branch is outside the canonical branches.');
  process.exit(1);
}

const refUrl =
  'https://api.github.com/repos/' +
  repository +
  '/git/ref/heads/' +
  encodeURIComponent(sourceBranch);

let liveSha = '';
try {
  const response = await fetch(refUrl, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-workflow-run-current-verifier',
    },
  });
  if (!response.ok) {
    throw new Error('GitHub API HTTP ' + response.status + ': ' + await response.text());
  }
  liveSha = String((await response.json())?.object?.sha ?? '').trim().toLowerCase();
} catch (error) {
  console.error('FAIL CLOSED: unable to resolve the live source branch head.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!/^[0-9a-f]{40}$/u.test(liveSha)) {
  console.error('FAIL CLOSED: live source branch returned no valid SHA.');
  process.exit(1);
}

if (liveSha !== sourceSha) {
  console.error(
    'STALE_WORKFLOW_RUN: source SHA ' + sourceSha +
    ' is superseded by live ' + sourceBranch + ' head ' + liveSha + '.',
  );

  try {
    const cancelResponse = await fetch(
      'https://api.github.com/repos/' + repository + '/actions/runs/' + encodeURIComponent(runId) + '/cancel',
      {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: 'Bearer ' + token,
          'x-github-api-version': '2022-11-28',
          'user-agent': 'FLIXO-workflow-run-current-verifier',
        },
      },
    );
    if (!cancelResponse.ok && cancelResponse.status !== 409) {
      throw new Error('GitHub API HTTP ' + cancelResponse.status + ': ' + await cancelResponse.text());
    }
    console.error('STALE_WORKFLOW_RUN_CANCEL_REQUESTED=' + runId);
  } catch (error) {
    console.error('FAIL CLOSED: unable to cancel stale workflow_run ' + runId + '.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  process.exit(1);
}

console.log(
  'WORKFLOW_RUN_SOURCE_CURRENT=1 SHA=' + sourceSha +
  ' BRANCH=' + sourceBranch +
  ' REPOSITORY=' + sourceRepository +
  ' LIVE_HEAD_ENFORCEMENT=MANDATORY',
);
