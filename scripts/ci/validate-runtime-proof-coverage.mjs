#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const env = (name, fallback = '') => String(process.env[name] ?? fallback).trim();
const base = env('FLIXO_PROOF_BASE_SHA', process.argv[2] ?? '');
const headSha = env('FLIXO_PROOF_HEAD_SHA', process.argv[3] ?? 'HEAD');

if (!/^[0-9a-f]{40}$/.test(base)) throw new Error('RUNTIME_PROOF_BASE_SHA_REQUIRED');

const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commitList = run(['rev-list', '--reverse', `${base}..${headSha}`]).split('\n').filter(Boolean);
const sensitive = /(?:^|[-_/])(liveness|wake|watchdog|lease|heartbeat|council|supersession)(?:[-_/]|$)|CELL-BOT-REGISTRY\.json|ACTION-REPAIR-SQUAD-REGISTRY\.json/i;
const proof = /(?:^|\/)(?:test-|verify-|validate-|assert-|check-)|\.test\.|\.spec\.|\.workflow\.yml$/i;
const closurePath = env('FLIXO_PROOF_HISTORICAL_CLOSURE_FILE', 'scripts/ci/runtime-proof-historical-closure.json');

const loadHistoricalClosure = () => {
  let raw;
  try {
    raw = JSON.parse(require('node:fs').readFileSync(require('node:path').join(root, closurePath), 'utf8'));
  } catch {
    return new Map();
  }
  if (raw?.schemaVersion !== 1 || raw?.policy !== 'HISTORICAL_RUNTIME_PROOF_CLOSURE-v1' || raw?.scope !== 'EXACT_SHA_ALLOWLIST_ONLY') {
    throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_INVALID');
  }
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const map = new Map();
  for (const entry of entries) {
    if (!/^[0-9a-f]{40}$/.test(String(entry?.commitSha ?? ''))) {
      throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_SHA_INVALID');
    }
    const paths = Array.isArray(entry?.sensitivePaths) ? [...new Set(entry.sensitivePaths)].sort() : [];
    const evidence = entry?.evidence;
    if (!paths.length || evidence?.workflow !== 'FLIXO Advanced Repair Contract' ||
        evidence?.conclusion !== 'success' || evidence?.independent !== true ||
        !Number.isInteger(evidence?.runId) || !Number.isInteger(evidence?.jobId) ||
        !Array.isArray(evidence?.requiredSteps) || evidence.requiredSteps.length < 1 ||
        typeof entry?.reason !== 'string' || !entry.reason.trim()) {
      throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_ENTRY_INVALID');
    }
    if (map.has(entry.commitSha)) throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_DUPLICATE_SHA');
    map.set(entry.commitSha, { paths, evidence, reason: entry.reason });
  }
  return map;
};

const historicalClosure = loadHistoricalClosure();

const closureMatches = (sha, sensitiveChanged) => {
  const entry = historicalClosure.get(sha);
  if (!entry) return false;
  const actual = [...new Set(sensitiveChanged)].sort();
  if (JSON.stringify(actual) !== JSON.stringify(entry.paths)) {
    throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_PATH_MISMATCH');
  }
  return true;
};

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
  const historicalClosureMatch = sensitiveChanged.length > 0 && proofChanged.length === 0
    ? closureMatches(sha, sensitiveChanged)
    : false;
  return {
    sha,
    changed,
    sensitiveChanged,
    proofChanged,
    selfProvingVerifierChange,
    historicalClosureMatch,
    status: sensitiveChanged.length === 0 || proofChanged.length > 0 || selfProvingVerifierChange || historicalClosureMatch ? 'PASS' : 'FAIL',
  };
});
const violations = commits.filter((item) => item.status === 'FAIL');

const result = {
  schemaVersion: 4,
  policy: 'SENSITIVE_CONTRACT_CHANGES_REQUIRE_PER_COMMIT_PROOF_WITH_EXPLICIT_HISTORICAL_CLOSURE',
  baseSha: base,
  headSha,
  commitCount: commits.length,
  commits: commits.map(({ sha, sensitiveChanged, proofChanged, historicalClosureMatch, status }) => ({ sha, sensitiveChanged, proofChanged, historicalClosureMatch, status })),
  violations: violations.map(({ sha, sensitiveChanged }) => ({ sha, sensitiveChanged })),
  status: violations.length ? 'FAIL' : 'PASS',
};
console.log(JSON.stringify(result, null, 2));
if (violations.length) throw new Error('SENSITIVE_CONTRACT_COMMIT_WITHOUT_PROOF');
