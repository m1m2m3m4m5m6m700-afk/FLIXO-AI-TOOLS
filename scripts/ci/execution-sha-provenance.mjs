#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const SHA_RE = /^[0-9a-f]{40}$/iu;

export function readExecutionSha({ cwd = process.cwd() } = {}) {
  const safeDirectory = String(cwd ?? '').trim();
  if (!safeDirectory) throw new Error('Execution SHA read requires a repository working directory');
  let sha;
  try {
    sha = execFileSync(
      'git',
      ['-c', `safe.directory=${safeDirectory}`, 'rev-parse', 'HEAD'],
      { cwd: safeDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to resolve repository HEAD for execution provenance: ${detail}`, { cause: error });
  }
  if (!SHA_RE.test(sha)) throw new Error(`Repository HEAD is not a valid Git SHA: ${sha || '<empty>'}`);
  return sha;
}

export function assertExpectedExecutionSha({ actualSha, expectedSha }) {
  const actual = String(actualSha ?? '').trim();
  const expected = String(expectedSha ?? '').trim();
  if (!SHA_RE.test(actual)) throw new Error('Actual execution SHA is missing or malformed');
  if (!SHA_RE.test(expected)) throw new Error('EXPECTED_SHA is missing or malformed');
  if (actual !== expected) {
    throw new Error(`Execution SHA mismatch: actual=${actual}; expected=${expected}`);
  }
  return actual;
}
