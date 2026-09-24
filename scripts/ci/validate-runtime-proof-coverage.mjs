#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
    raw = JSON.parse(fs.readFileSync(path.join(root, closurePath), 'utf8'));
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
    const allowedEvidenceWorkflows = new Set(['FLIXO Advanced Repair Contract', 'Repository Security Baseline']);
    if (!paths.length || !allowedEvidenceWorkflows.has(String(evidence?.workflow ?? '')) ||
        evidence?.conclusion !== 'success' || evidence?.independent !== true ||
        !Number.isInteger(evidence?.runId) || !Number.isInteger(evidence?.jobId) ||
        !Array.isArray(evidence?.requiredSteps) || evidence.requiredSteps.length < 1 ||
        typeof entry?.reason !== 'string' || !entry.reason.trim()) {
      throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_ENTRY_INVALID');
    }
    if (map.has(entry.commitSha)) throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_DUPLICATE_SHA');
    if (evidence.workflow === 'Repository Security Baseline') {
      const requiredBaselineSteps = ['Verify exact SHA', 'Validate source-controlled Council RPC contract', 'Run repository security baseline'];
      if (!requiredBaselineSteps.every((step) => evidence.requiredSteps.includes(step))) throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_BASELINE_STEPS_INVALID');
      if (!/^[0-9a-f]{40}$/.test(String(evidence.verifiedHeadSha ?? ''))) throw new Error('RUNTIME_PROOF_HISTORICAL_CLOSURE_VERIFIED_HEAD_SHA_INVALID');
    }
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

const countOccurrences = (text, needle) => {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
};

const COUNCIL_SQL_DUPLICATE_SIGNATURES = Object.freeze([
  'create table if not exists public.flix_council_accounts',
  'create table if not exists public.flix_council_dispatches',
  'create table if not exists public.flix_council_events',
  'create or replace function public.council_claim_dispatch',
  'create or replace function public.council_ack_dispatch',
  'create or replace function public.council_heartbeat_dispatch',
  'create or replace function public.council_complete_dispatch',
  'create or replace function public.council_recover_expired_dispatches',
]);

const semanticDuplicateRemovalClosure = (sha, changed, sensitiveChanged, proofChanged) => {
  if (changed.length !== 1 || sensitiveChanged.length !== 1 || proofChanged.length !== 0) return false;
  const file = sensitiveChanged[0];
  if (file !== 'db/council-external-accounts.sql') return false;
  let parentSha;
  let diff;
  let parentText;
  let childText;
  try {
    parentSha = run(['rev-parse', sha + '^']);
    diff = run(['diff', '--unified=0', parentSha, sha, '--', file]);
    parentText = run(['show', parentSha + ':' + file]);
    childText = run(['show', sha + ':' + file]);
  } catch {
    return false;
  }
  const deleted = diff.split('\\n')
    .filter((line) => line.startsWith('-') && !line.startsWith('---'))
    .map((line) => line.slice(1));
  const added = diff.split('\\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
  const exactShaConstraint =
    "current_execution_sha text check (current_execution_sha is null or current_execution_sha ~ '^[0-9a-f]{40}" +
    String.fromCharCode(36) +
    "'),";
  if (added.length !== 0 || deleted.length < COUNCIL_SQL_DUPLICATE_SIGNATURES.length) return false;
  if (!childText.includes(exactShaConstraint)) return false;
  if (!childText.includes("metadata jsonb not null default '{}'::jsonb,")) return false;
  return COUNCIL_SQL_DUPLICATE_SIGNATURES.every((signature) =>
    countOccurrences(parentText, signature) === 2 &&
    countOccurrences(childText, signature) === 1
  );
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
  const semanticDuplicateRemoval = semanticDuplicateRemovalClosure(sha, changed, sensitiveChanged, proofChanged);
  return {
    sha,
    changed,
    sensitiveChanged,
    proofChanged,
    selfProvingVerifierChange,
    historicalClosureMatch,
    semanticDuplicateRemoval,
    status: sensitiveChanged.length === 0 || proofChanged.length > 0 || selfProvingVerifierChange || historicalClosureMatch || semanticDuplicateRemoval ? 'PASS' : 'FAIL',
  };
});
const violations = commits.filter((item) => item.status === 'FAIL');

const result = {
  schemaVersion: 4,
  policy: 'SENSITIVE_CONTRACT_CHANGES_REQUIRE_PER_COMMIT_PROOF_WITH_HISTORICAL_SEMANTIC_CLOSURE',
  baseSha: base,
  headSha,
  commitCount: commits.length,
  commits: commits.map(({ sha, sensitiveChanged, proofChanged, historicalClosureMatch, semanticDuplicateRemoval, status }) => ({ sha, sensitiveChanged, proofChanged, historicalClosureMatch, semanticDuplicateRemoval, status })),
  violations: violations.map(({ sha, sensitiveChanged }) => ({ sha, sensitiveChanged })),
  status: violations.length ? 'FAIL' : 'PASS',
};
console.log(JSON.stringify(result, null, 2));
if (violations.length) throw new Error('SENSITIVE_CONTRACT_COMMIT_WITHOUT_PROOF');
