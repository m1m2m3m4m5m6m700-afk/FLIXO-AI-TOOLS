#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value));

const runGit = (cwd, args) => execFileSync('git', args, {
  cwd,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

const readDigest = (file) => sha256(fs.readFileSync(file));

const gateWeakening = /continue-on-error\s*:\s*true|continue-on-error\s*:\s*\$\{\{\s*true|force\s*:\s*true|\|\|\s*true|exit\s+0\b/iu;

export function snapshotPaths(root, paths) {
  const result = {};
  for (const file of [...new Set(paths.map(String))]) {
    const absolute = path.resolve(root, file);
    if (!fs.existsSync(absolute)) throw new Error(`DIFFERENTIAL_FILE_MISSING:${file}`);
    result[file] = { sha256: readDigest(absolute), bytes: fs.statSync(absolute).size };
  }
  return result;
}

export function verifyDifferential({
  repoRoot,
  targetSha,
  candidateId,
  operationPaths,
  candidateChecks,
  expectedChecks = [],
  baselineStatus = 'UNKNOWN',
  candidateCheckResults = [],
  requireExecutionEvidence = true,
} = {}) {
  if (!repoRoot || !exactSha(targetSha)) throw new Error('DIFFERENTIAL_IDENTITY_REQUIRED');
  const changed = runGit(repoRoot, ['diff', '--name-only', targetSha]).split(/\r?\n/u).filter(Boolean);
  const expected = [...new Set(operationPaths.map(String))].sort();
  const actual = [...new Set(changed)].sort();
  const unauthorized = actual.filter((file) => !expected.includes(file));

  let weakening = [];
  for (const file of actual) {
    const absolute = path.resolve(repoRoot, file);
    const inspectGate = /^\.github\/workflows\//u.test(file) || file.startsWith('scripts/ci/');
    if (inspectGate && fs.existsSync(absolute) && gateWeakening.test(fs.readFileSync(absolute, 'utf8'))) weakening.push(file);
  }

  const declaredChecks = [...new Set((candidateChecks ?? []).map(String).filter(Boolean))];
  const executedResults = Array.isArray(candidateCheckResults) ? candidateCheckResults.filter(Boolean) : [];
  const executionByCheck = new Map(executedResults.map((item) => [String(item.check), item]));
  const missingExpectedChecks = expectedChecks.filter((check) => {
    const receipt = executionByCheck.get(String(check));
    return !receipt || receipt.status !== 'PASS' || Number(receipt.exitCode ?? 1) !== 0;
  });
  const missingExecutionEvidence = requireExecutionEvidence && expectedChecks.some((check) => {
    const receipt = executionByCheck.get(String(check));
    return !receipt || typeof receipt.stdoutDigest !== 'string' || typeof receipt.stderrDigest !== 'string' || typeof receipt.startedAt !== 'string' || typeof receipt.finishedAt !== 'string';
  });
  const checks = expectedChecks.map((check) => {
    const receipt = executionByCheck.get(String(check));
    return receipt
      ? { check: String(check), status: receipt.status, exitCode: Number(receipt.exitCode ?? 1), stdoutDigest: receipt.stdoutDigest, stderrDigest: receipt.stderrDigest, startedAt: receipt.startedAt, finishedAt: receipt.finishedAt, durationMs: Number(receipt.durationMs ?? 0) }
      : { check: String(check), status: 'MISSING_EXECUTION', exitCode: null };
  });

  const passed = unauthorized.length === 0 &&
    weakening.length === 0 &&
    missingExpectedChecks.length === 0 &&
    missingExecutionEvidence === false &&
    executedResults.length > 0 &&
    baselineStatus !== 'FAIL';

  const changedFileCount = actual.length;
  const minimality = changedFileCount === expected.length
    ? 100
    : Math.max(0, 100 - Math.abs(changedFileCount - expected.length) * 20);

  return {
    protocol: 'DIFFERENTIAL_REPAIR_VERIFICATION_V1',
    candidateId,
    targetSha,
    baselineStatus,
    changedFiles: actual,
    expectedFiles: expected,
    unauthorizedFiles: unauthorized,
    gateWeakeningFiles: weakening,
    declaredCandidateChecks: declaredChecks,
    candidateChecks: checks,
    executionEvidence: { required: requireExecutionEvidence, receiptCount: executedResults.length, missing: missingExecutionEvidence },
    missingExpectedChecks,
    minimalityScore: minimality,
    status: passed ? 'PASS' : 'FAIL',
    authority: 'CANONICAL_GREEN_ONLY',
  };
}
