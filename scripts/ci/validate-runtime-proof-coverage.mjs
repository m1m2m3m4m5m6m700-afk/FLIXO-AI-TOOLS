#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const env = (name, fallback = '') => String(process.env[name] ?? fallback).trim();
const base = env('FLIXO_PROOF_BASE_SHA', process.argv[2] ?? '');
const headSha = env('FLIXO_PROOF_HEAD_SHA', process.argv[3] ?? 'HEAD');

if (!/^[0-9a-f]{40}$/.test(base)) throw new Error('RUNTIME_PROOF_BASE_SHA_REQUIRED');

const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commitList = run(['rev-list', '--reverse', `${base}..${headSha}`]).split('\n').filter(Boolean);
const sensitive = /(liveness|wake|watchdog|lease|heartbeat|council|supersession)|CELL-BOT-REGISTRY\.json|ACTION-REPAIR-SQUAD-REGISTRY\.json/i;
const proof = /(?:^|\/)(?:test-|verify-|validate-|assert-|check-)|\.test\.|\.spec\.|\.workflow\.yml$/i;

const commits = commitList.map((sha) => {
  const changed = run(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]).split('\n').filter(Boolean);
  const sensitiveChanged = changed.filter((p) => sensitive.test(p));
  const proofChanged = changed.filter((p) => proof.test(p));
  const verifierSource = run(['show', sha + ':scripts/ci/verify-council-live-runtime.mjs']);
  const selfProvingVerifierChange = sensitiveChanged.length > 0 &&
    sensitiveChanged.every((p) => p === 'scripts/ci/verify-council-live-runtime.mjs') &&
    proofChanged.length === 0 &&
    /SELF_PROOF_CONTRACT:v1/.test(verifierSource) &&
    /flix_council_events/.test(verifierSource) &&
    /residencyRequired/.test(verifierSource) &&
    /exact_sha/.test(verifierSource);
  return {
    sha,
    changed,
    sensitiveChanged,
    proofChanged,
    selfProvingVerifierChange,
    status: sensitiveChanged.length === 0 || proofChanged.length > 0 || selfProvingVerifierChange ? 'PASS' : 'FAIL',
  };
});
const violations = commits.filter((item) => item.status === 'FAIL');

const result = {
  schemaVersion: 3,
  policy: 'SENSITIVE_CONTRACT_CHANGES_REQUIRE_PER_COMMIT_PROOF',
  baseSha: base,
  headSha,
  commitCount: commits.length,
  commits: commits.map(({ sha, sensitiveChanged, proofChanged, status }) => ({ sha, sensitiveChanged, proofChanged, status })),
  violations: violations.map(({ sha, sensitiveChanged }) => ({ sha, sensitiveChanged })),
  status: violations.length ? 'FAIL' : 'PASS',
};
console.log(JSON.stringify(result, null, 2));
if (violations.length) throw new Error('SENSITIVE_CONTRACT_COMMIT_WITHOUT_PROOF');
