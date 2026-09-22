#!/usr/bin/env node

import { execFile } from 'node:child_process';

const expectedSha = (process.env.EXPECTED_SHA ?? '').trim();
const expectedBranch = (process.env.EXPECTED_BRANCH ?? '').trim();
const expectedRepository = (process.env.EXPECTED_REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? '').trim();
const token = (process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim();

if (!/^[0-9a-f]{40}$/iu.test(expectedSha)) {
  console.error('FAIL CLOSED: EXPECTED_SHA is missing or malformed.');
  process.exit(1);
}
if (!expectedBranch || !expectedRepository || expectedRepository.split('/').length !== 2) {
  console.error('FAIL CLOSED: expected repository/branch identity is incomplete.');
  process.exit(1);
}
const branchPath = expectedBranch.split('/').map(encodeURIComponent).join('/');
const apiUrl = `https://api.github.com/repos/${expectedRepository}/git/ref/heads/${branchPath}`;
const remoteRef = `refs/heads/${expectedBranch}`;

let localSha;
try {
  localSha = await new Promise((resolve, reject) => {
    execFile('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(String(stdout ?? '').trim());
    });
  });
} catch (error) {
  console.error('FAIL CLOSED: unable to resolve local checkout SHA.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
if (!/^[0-9a-f]{40}$/iu.test(localSha) || localSha !== expectedSha) {
  console.error(`FAIL CLOSED: local checkout SHA ${localSha || '<empty>'} does not equal EXPECTED_SHA ${expectedSha}.`);
  process.exit(1);
}

let actualSha;
let resolutionMode = token ? 'GITHUB_API' : 'PUBLIC_GIT_REMOTE';
try {
  if (token) {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'FLIXO-current-commit-verifier',
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub API HTTP ${response.status}: ${await response.text()}`);
    }
    const body = await response.json();
    actualSha = String(body?.object?.sha ?? '').trim();
  } else {
    const remote = await new Promise((resolve, reject) => {
      execFile(
        'git',
        ['ls-remote', `https://github.com/${expectedRepository}.git`, remoteRef],
        { encoding: 'utf8' },
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve(String(stdout ?? ''));
        },
      );
    });
    actualSha = String(remote).trim().split(/\s+/u)[0] ?? '';
  }
} catch (error) {
  console.error('FAIL CLOSED: unable to resolve the current branch tip from GitHub.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!/^[0-9a-f]{40}$/iu.test(actualSha)) {
  console.error('FAIL CLOSED: GitHub returned no valid branch SHA.');
  process.exit(1);
}

if (actualSha !== expectedSha) {
  console.error(`FAIL CLOSED: commit ${expectedSha} is superseded by ${actualSha} on ${expectedRepository}/${expectedBranch}.`);
  process.exit(1);
}

console.log(`CURRENT_COMMIT_VERIFIED=1 SHA=${expectedSha} BRANCH=${expectedBranch} REPOSITORY=${expectedRepository} MODE=${resolutionMode}`);