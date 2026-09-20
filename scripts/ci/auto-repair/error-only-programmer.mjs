#!/usr/bin/env node

import { fingerprintFailure, normalizeFailure } from './fingerprint.mjs';

const SHA_RE = /^[a-f0-9]{40}$/u;
const SOURCE_EXT = /\.(?:mjs|cjs|js|ts|tsx|jsx)$/iu;
const TEST_PATH = /(^|\/)(?:tests?|__tests__)(?:\/|$)|(?:^|\/)test-[^/]+\.(?:mjs|cjs|js|ts|tsx|jsx)$/iu;
const CONTROL_PATH = /^(?:scripts\/ci\/(?:repair-|auto-repair)|scripts\/ci\/agent-|\.github\/workflows\/)/u;

const DRIVER_BY_RULE = Object.freeze({
  'eslint-unused': 'eslint-ast',
  'prettier-file': 'prettier-deterministic',
  'prepared-source-change': 'prepared-source-change',
});

function exactSha(value) { return SHA_RE.test(String(value ?? '')); }
function normalizePath(value) { return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//u, ''); }

export function classifyRepairTarget({ diagnosis = null, selected = null } = {}) {
  const files = [...new Set((Array.isArray(selected?.files) ? selected.files : [selected?.file || diagnosis?.location?.file || diagnosis?.causalGraph?.responsibleSource])
    .map(normalizePath).filter(Boolean))];
  const file = files[0] || '';
  const rule = String(selected?.id ?? '');
  const driver = DRIVER_BY_RULE[rule] ?? null;
  const problems = [];

  if (!file) problems.push('ERROR_SOURCE_LOCATION_MISSING');
  for (const candidate of files) {
    if (!SOURCE_EXT.test(candidate)) problems.push('ERROR_SOURCE_FILE_TYPE_UNSUPPORTED:' + candidate);
    if (TEST_PATH.test(candidate)) problems.push('ERROR_REPAIR_TEST_SURFACE_BLOCKED:' + candidate);
    if (CONTROL_PATH.test(candidate)) problems.push('ERROR_REPAIR_CONTROL_PLANE_BLOCKED:' + candidate);
  }
  if (!driver) problems.push('ERROR_REPAIR_DRIVER_UNSUPPORTED');
  if (diagnosis?.decision === 'BLOCK_EXTERNAL') problems.push('ERROR_EXTERNAL_BLOCKER_IS_NOT_SOURCE_DEFECT');
  if (diagnosis?.rootCause === 'UNKNOWN_RCA') problems.push('ERROR_UNKNOWN_RCA_BLOCKED');
  if (diagnosis?.ambiguity === true) problems.push('ERROR_AMBIGUOUS_CAUSALITY_BLOCKED');

  return Object.freeze({
    targetFile: file || null,
    targetFiles: files,
    rule: rule || null,
    driver,
    sourceOnly: true,
    testsImmutable: true,
    controlPlaneImmutable: true,
    allowed: problems.length === 0,
    problems,
  });
}

export function buildErrorOnlyRepairModel({
  log = '',
  diagnosis = null,
  selected = null,
  targetSha = '',
  failedSha = null,
} = {}) {
  const fingerprint = fingerprintFailure(log);
  const normalizedFailure = normalizeFailure(log);
  const classification = classifyRepairTarget({ diagnosis, selected });
  const shaValid = exactSha(targetSha) && (!failedSha || exactSha(failedSha));
  const identityMatches = !failedSha || !exactSha(failedSha) || failedSha === targetSha || diagnosis?.targetSha === targetSha || diagnosis?.entrySha === targetSha;
  const directSignal = diagnosis?.directFailureSignal === true;
  const confidence = Number(diagnosis?.causalConfidence ?? 0);
  const sourceGrounded = Boolean(diagnosis?.location?.file || diagnosis?.causalGraph?.responsibleSource || selected?.file);
  const mutationAllowed = classification.allowed && shaValid && identityMatches && directSignal && confidence >= 0.75 && diagnosis?.sourceMutationAllowed !== false;

  return Object.freeze({
    schemaVersion: 1,
    authority: 'ERROR_ONLY_PROGRAMMER_MODEL',
    mode: 'SOURCE_ERROR_REPAIR_ONLY',
    identity: { fingerprint, targetSha, failedSha: failedSha || null, normalizedFailure },
    diagnosis: {
      rootCause: diagnosis?.rootCause ?? null,
      causalSource: diagnosis?.location?.file ?? diagnosis?.causalGraph?.responsibleSource ?? null,
      violatedInvariant: diagnosis?.violatedInvariant ?? diagnosis?.causalGraph?.violatedInvariant ?? null,
      confidence,
      directSignal,
      sourceGrounded,
    },
    repair: {
      rule: selected?.id ?? null,
      driver: classification.driver,
      targetFile: classification.targetFile,
      targetFiles: classification.targetFiles,
      mutationAllowed,
      reason: mutationAllowed ? 'ERROR_SOURCE_MATCHED_AND_GUARDED' : 'ERROR_ONLY_GUARD_BLOCKED',
    },
    invariants: [
      'MUTATE_ONLY_THE_CAUSAL_SOURCE',
      'NEVER_MUTATE_TESTS',
      'NEVER_MUTATE_CONTROL_PLANE',
      'NEVER_WEAKEN_GATES',
      'EXACT_SHA_REQUIRED',
      'CURRENT_FAILURE_MUST_BE_PROVEN',
      'FAILED_STRATEGY_MUST_NOT_REPEAT_WITHOUT_NEW_EVIDENCE',
    ],
    blockedReasons: classification.problems.concat(!shaValid ? ['ERROR_TARGET_SHA_INVALID'] : [], !identityMatches ? ['ERROR_TARGET_SHA_IDENTITY_MISMATCH'] : [], !directSignal ? ['ERROR_DIRECT_FAILURE_SIGNAL_MISSING'] : [], confidence < 0.75 ? ['ERROR_CAUSAL_CONFIDENCE_TOO_LOW'] : []),
    failClosed: !mutationAllowed,
  });
}

if (process.argv[1]?.endsWith('error-only-programmer.mjs') && (process.argv[2] || '') === 'self-test') {
  const result = buildErrorOnlyRepairModel({
    log: 'ERROR eslint: no-unused-vars at src/example.ts:10:2',
    diagnosis: {
      rootCause: 'lint',
      decision: 'ALLOW_BOUNDED_MUTATION',
      sourceMutationAllowed: true,
      directFailureSignal: true,
      causalConfidence: 0.92,
      location: { file: 'src/example.ts' },
    },
    selected: { id: 'eslint-unused', file: 'src/example.ts' },
    targetSha: 'a'.repeat(40),
  });
  if (!result.repair.mutationAllowed || result.repair.driver !== 'eslint-ast') process.exit(1);
  console.log('ERROR_ONLY_PROGRAMMER_MODEL_SELF_TEST=PASS');
}
