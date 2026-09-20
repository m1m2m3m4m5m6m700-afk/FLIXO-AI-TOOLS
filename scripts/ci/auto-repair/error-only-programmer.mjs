#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fingerprintFailure, normalizeFailure } from './fingerprint.mjs';

const SHA_RE = /^[a-f0-9]{40}$/u;
const SOURCE_EXT = /\.(?:mjs|cjs|js|ts|tsx|jsx)$/iu;
const TEST_PATH = /(^|\/)(?:tests?|__tests__)(?:\/|$)|(?:^|\/)test-[^/]+\.(?:mjs|cjs|js|ts|tsx|jsx)$/iu;
const CONTROL_PATH = /^(?:scripts\/ci\/(?:repair-|auto-repair)|scripts\/ci\/agent-|\.github\/workflows\/)/u;

const DRIVER_DEFINITIONS = Object.freeze({
  'eslint-ast': Object.freeze({ deterministic: true, maxScope: 'exact-file', class: 'lint' }),
  'prettier-deterministic': Object.freeze({ deterministic: true, maxScope: 'exact-file', class: 'format' }),
  'prepared-source-change': Object.freeze({ deterministic: true, maxScope: 'declared-affected-source', class: 'prepared' }),
  'typescript-missing-import': Object.freeze({ deterministic: true, maxScope: 'exact-file', class: 'typescript', requires: 'TS2304_CAN_T_FIND_NAME' }),
});

const DRIVER_BY_RULE = Object.freeze({
  'eslint-unused': 'eslint-ast',
  'prettier-file': 'prettier-deterministic',
  'prepared-source-change': 'prepared-source-change',
  'typescript-missing-import': 'typescript-missing-import',
});

function exactSha(value) { return SHA_RE.test(String(value ?? '')); }
function normalizePath(value) { return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//u, ''); }
function tsMissingImportSignal(log) { return /TS2304\b|Cannot find name ['\"]/iu.test(String(log ?? '')); }
function deriveSemanticSourceSlice({ targetDir = process.cwd(), location = null } = {}) {
  const file = normalizePath(location?.file);
  const line = Number(location?.line ?? 0);
  if (!file || !line) return Object.freeze({ available: false, file: file || null, line: line || null, symbol: null, startLine: null, endLine: null });
  try {
    const lines = fs.readFileSync(path.resolve(targetDir, file), 'utf8').split(/\r?\n/u);
    const start = Math.max(0, line - 8);
    const end = Math.min(lines.length, line + 7);
    const context = lines.slice(start, end);
    const declaration = context.map((text, i) => ({ text, line: start + i + 1 })).reverse().find(({ text }) => /\\b(?:function|class|const|let|var|enum|interface|type)\\s+[A-Za-z_$][\\w$]*/u.test(text));
    const symbol = declaration?.text.match(/\\b(?:function|class|const|let|var|enum|interface|type)\\s+([A-Za-z_$][\\w$]*)/u)?.[1] ?? null;
    return Object.freeze({ available: true, file, line, startLine: start + 1, endLine: end, symbol, excerpt: context.map((text, i) => ({ line: start + i + 1, text: String(text).slice(0, 500) })) });
  } catch { return Object.freeze({ available: false, file, line, symbol: null, startLine: null, endLine: null }); }
}
function strategyKey({ driver, rule, diagnosis, classification, semanticSlice }) {
  return [driver || 'none', rule || 'none', diagnosis?.rootCause || 'unknown', classification?.targetFile || classification?.targetFiles?.join(',') || 'none', diagnosis?.diagnosticCode || 'none', semanticSlice?.symbol || 'module']
    .map((value) => String(value).replace(/[^a-z0-9._,-]+/gi, '_')).join('|');
}

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
  if (rule === 'typescript-missing-import' && !tsMissingImportSignal(diagnosis?.failureLog ?? diagnosis?.log ?? '')) problems.push('ERROR_TS_MISSING_IMPORT_SIGNAL_REQUIRED');

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
  targetDir = process.cwd(),
} = {}) {
  const fingerprint = fingerprintFailure(log);
  const normalizedFailure = normalizeFailure(log);
  const normalizedDiagnosis = { ...(diagnosis ?? {}), failureLog: log };
  const classification = classifyRepairTarget({ diagnosis: normalizedDiagnosis, selected });
  const semanticSlice = deriveSemanticSourceSlice({ targetDir, location: diagnosis?.location });
  const shaValid = exactSha(targetSha) && (!failedSha || exactSha(failedSha));
  const identityMatches = !failedSha || !exactSha(failedSha) || failedSha === targetSha || diagnosis?.targetSha === targetSha || diagnosis?.entrySha === targetSha;
  const directSignal = diagnosis?.directFailureSignal === true;
  const confidence = Number(diagnosis?.causalConfidence ?? 0);
  const sourceGrounded = Boolean(diagnosis?.location?.file || diagnosis?.causalGraph?.responsibleSource || selected?.file);
  const driverDefinition = classification.driver ? DRIVER_DEFINITIONS[classification.driver] : null;
  const mutationAllowed = classification.allowed && Boolean(driverDefinition?.deterministic) && shaValid && identityMatches && directSignal && confidence >= 0.75 && diagnosis?.sourceMutationAllowed !== false;

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
      diagnosticCode: diagnosis?.diagnosticCode ?? (tsMissingImportSignal(log) ? 'TS2304' : null),
      semanticSlice,
    },
    repair: {
      rule: selected?.id ?? null,
      driver: classification.driver,
      targetFile: classification.targetFile,
      targetFiles: classification.targetFiles,
      mutationAllowed,
      driverDefinition,
      strategyKey: strategyKey({ driver: classification.driver, rule: selected?.id ?? null, diagnosis, classification, semanticSlice }),
      reason: mutationAllowed ? 'ERROR_SOURCE_MATCHED_AND_GUARDED' : 'ERROR_ONLY_GUARD_BLOCKED',
    },
    candidates: Object.entries(DRIVER_DEFINITIONS).map(([id, definition]) => ({ id, ...definition, selected: id === classification.driver })),
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
