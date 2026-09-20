#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const expectedSha = (process.env.EXPECTED_SHA ?? '').trim();
const expectedBranch = (process.env.EXPECTED_BRANCH ?? '').trim();
const expectedRepository = (process.env.EXPECTED_REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? '').trim();

if (!/^[0-9a-f]{40}$/i.test(expectedSha)) {
  console.error('FAIL CLOSED: EXPECTED_SHA is missing or malformed.');
  process.exit(1);
}
if (!expectedBranch || !expectedRepository || expectedRepository.split('/').length !== 2) {
  console.error('FAIL CLOSED: expected repository/branch identity is incomplete.');
  process.exit(1);
}

const apiPath = `repos/${expectedRepository}/git/ref/heads/${expectedBranch.split('/').map(encodeURIComponent).join('/')}`;
let actualSha;

try {
  const raw = execFileSync(
    process.env.GH_BIN ?? 'gh',
    ['api', apiPath, '--header', 'Accept: application/vnd.github+json', '--jq', '.object.sha'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '' },
    },
  );
  actualSha = raw.trim();
} catch (error) {
  console.error('FAIL CLOSED: unable to resolve the current branch tip from GitHub.');
  if (error instanceof Error && error.message) console.error(error.message);
  process.exit(1);
}

if (actualSha !== expectedSha) {
  console.error(`FAIL CLOSED: commit ${expectedSha} is superseded by ${actualSha} on ${expectedRepository}/${expectedBranch}.`);
  process.exit(1);
}

console.log(`CURRENT_COMMIT_VERIFIED=1 SHA=${expectedSha} BRANCH=${expectedBranch} REPOSITORY=${expectedRepository}`);
