#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DEFAULT_CONFIG = 'configs/in-repo-repair-v2.yml';
const SHA_RE = /^[a-f0-9]{40}$/u;
const FP_RE = /^[a-f0-9]{64}$/u;
const FORBIDDEN_MUTATION_RE = /continue-on-error|test\.(?:skip|only)|describe\.(?:skip|only)|eslint-disable|@ts-(?:ignore|nocheck)|gh\s+(?:pr\s+merge|workflow\s+run).*--ref\s+main/iu;

function fail(code, details) {
  const error = new Error('IN_REPO_REPAIR_V2=' + code);
  error.details = details;
  throw error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function git(targetDir, args) {
  return execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8' }).trim();
}

function scalar(text, key, fallback) {
  const match = String(text).match(new RegExp('^\\s*' + key + ':\\s*([^#\\n]+)', 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : fallback;
}

export function loadPolicy(configPath = DEFAULT_CONFIG) {
  const text = fs.readFileSync(configPath, 'utf8');
  const policy = Object.freeze({
    maxRepairCycles: Number(scalar(text, 'max_repair_cycles', '3')),
    searchSpaceStrategy: scalar(text, 'search_space_strategy', 'EVIDENCE_BOUNDED'),
    enforceRcaManifest: scalar(text, 'enforce_rca_manifest', 'true') === 'true',
    requireThreeHypotheses: scalar(text, 'require_three_hypotheses', 'true') === 'true',
    allowMultiFileMutation: scalar(text, 'allow_multi_file_mutation', 'false') === 'true',
    requireExactSha: scalar(text, 'require_exact_sha', 'true') === 'true',
    requireDirectFailureSignal: scalar(text, 'require_direct_failure_signal', 'true') === 'true',
    requireNonAmbiguousRca: scalar(text, 'require_non_ambiguous_rca', 'true') === 'true',
    isolationLevel: scalar(text, 'isolation_level', 'SURGICAL_PATCH'),
    falsifierMode: scalar(text, 'mode', 'CONVERGENCE_GUIDED'),
    requireCounterexampleOnReject: scalar(text, 'require_counterexample_on_reject', 'true') === 'true',
    requireFiniteInvariantProof: scalar(text, 'require_finite_invariant_proof', 'true') === 'true',
    requirePassConfirmed: scalar(text, 'require_pass_confirmed', 'true') === 'true',
    canonicalGreenFinalAuthority: scalar(text, 'canonical_green_is_final_authority', 'true') === 'true'
  });
  if (policy.maxRepairCycles !== 3) fail('CONFIG_MAX_CYCLES_MUST_BE_3');
  if (policy.searchSpaceStrategy !== 'EVIDENCE_BOUNDED') fail('CONFIG_SEARCH_SPACE_STRATEGY_INVALID');
  if (policy.allowMultiFileMutation) fail('CONFIG_MULTI_FILE_MUTATION_MUST_BE_DISABLED');
  if (policy.isolationLevel !== 'SURGICAL_PATCH') fail('CONFIG_ISOLATION_LEVEL_INVALID');
  if (policy.falsifierMode !== 'CONVERGENCE_GUIDED') fail('CONFIG_FALSIFIER_MODE_INVALID');
  return policy;
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fail('JSON_EVIDENCE_MALFORMED', file);
  }
}

function unique(items) {
  return [...new Set(items.map(function(item) { return String(item ?? '').trim(); }).filter(Boolean))];
}

function hypothesisRecord(item, role, rank) {
  return {
    id: String(item?.id ?? item?.rootCause ?? item?.name ?? 'HYPOTHESIS_' + rank),
    rank,
    role,
    score: Number(item?.score ?? item?.confidence ?? 0),
    evidence: unique([
      ...(Array.isArray(item?.evidenceLines) ? item.evidenceLines : []),
      ...(item?.feature ? ['feature:' + item.feature] : [])
    ]).slice(0, 8)
  };
}

function buildThreeHypotheses(diagnosis, plan) {
  const raw = [
    ...(Array.isArray(diagnosis?.hypotheses) ? diagnosis.hypotheses : []),
    ...(Array.isArray(plan?.candidates) ? plan.candidates : []),
    diagnosis?.secondHypothesis ?? null
  ].filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    const record = hypothesisRecord(item, result.length === 0 ? 'PRIMARY' : 'ALTERNATIVE', result.length + 1);
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    result.push(record);
    if (result.length === 3) break;
  }
  const fallbacks = [
    ['BOUNDARY_OR_SCOPE_DRIFT', 'ALTERNATIVE'],
    ['STALE_OR_MISSING_EVIDENCE', 'ALTERNATIVE'],
    ['DEPENDENCY_OR_RUNTIME_INTERACTION', 'ALTERNATIVE']
  ];
  for (const pair of fallbacks) {
    if (result.length >= 3) break;
    if (seen.has(pair[0])) continue;
    seen.add(pair[0]);
    result.push(hypothesisRecord({ id: pair[0], score: 0, evidenceLines: ['UNPROVEN_ALTERNATIVE_REQUIRES_FALSIFICATION'] }, pair[1], result.length + 1));
  }
  return result.slice(0, 3);
}

function deriveInvariant(diagnosis, selected) {
  const explicit = String(
    diagnosis?.repairHypothesis?.violatedInvariant ??
    diagnosis?.causalGraph?.violatedInvariant ??
    process.env.FLIXO_VIOLATED_INVARIANT ??
    ''
  ).trim();
  if (explicit && !/UNKNOWN_INVARIANT_UNPROVEN/iu.test(explicit)) return explicit;
  const cause = String(diagnosis?.rootCause ?? selected?.id ?? '').toLowerCase();
  const defaults = [
    [/lint|format/u, 'The demonstrated source diagnostic must disappear without weakening unrelated validation.'],
    [/typescript/u, 'The affected type contract must hold for the reported symbol without introducing a type escape.'],
    [/webkit|playwright/u, 'The affected browser contract must recover on the reported target without changing unrelated browser behavior.'],
    [/certification/u, 'The canonical evidence graph must contain complete exact-SHA proof for the affected gate.'],
    [/liveness|contract/u, 'The canonical state-transition contract must remain internally consistent and fail closed on invalid transitions.'],
    [/lease|claim|concurr|atomic|lock/u, 'Exclusive state transitions must permit at most one successful claimant for the same target state.'],
  ];
  const match = defaults.find(function(pair) { return pair[0].test(cause); });
  return match ? match[1] : '';
}

function primaryFile(diagnosis, selected, plan) {
  return unique([
    diagnosis?.location?.file,
    ...(Array.isArray(diagnosis?.affectedPaths) ? diagnosis.affectedPaths : []),
    selected?.file,
    ...(Array.isArray(selected?.files) ? selected.files : []),
    plan?.reasoning?.location?.file
  ])[0] ?? null;
}

export function buildRcaManifest(input) {
  const targetDir = input.targetDir ?? ROOT;
  const targetSha = String(input.targetSha ?? '');
  const actualSha = git(targetDir, ['rev-parse', 'HEAD']);
  const failureFingerprint = String(input.failureFingerprint ?? '');
  const diagnosis = input.diagnosis ?? null;
  const plan = input.plan ?? null;
  const selected = input.selected ?? null;
  const policy = input.policy ?? loadPolicy();
  const cycle = Number(input.cycle ?? 1);

  if (!SHA_RE.test(targetSha) || actualSha !== targetSha) fail('TARGET_SHA_MISMATCH', { expected: targetSha, actual: actualSha });
  if (!FP_RE.test(failureFingerprint)) fail('FAILURE_FINGERPRINT_INVALID');
  if (!Number.isInteger(cycle) || cycle < 1 || cycle > policy.maxRepairCycles) fail('REPAIR_CYCLE_OUT_OF_BOUNDS');

  const directFailureSignal = diagnosis?.directFailureSignal === true;
  const nonAmbiguous = diagnosis?.ambiguity === false;
  if (policy.requireDirectFailureSignal && !directFailureSignal) fail('DIRECT_FAILURE_SIGNAL_REQUIRED');
  if (policy.requireNonAmbiguousRca && !nonAmbiguous) fail('NON_AMBIGUOUS_RCA_REQUIRED');

  const invariant = deriveInvariant(diagnosis, selected);
  if (!invariant || /UNKNOWN_INVARIANT_UNPROVEN/iu.test(invariant)) fail('INVARIANT_NOT_PROVEN');

  const boundary = primaryFile(diagnosis, selected, plan);
  if (!boundary) fail('PRIMARY_BOUNDARY_FILE_REQUIRED');

  const hypotheses = buildThreeHypotheses(diagnosis, plan);
  if (policy.requireThreeHypotheses && hypotheses.length !== 3) fail('THREE_HYPOTHESES_REQUIRED');

  const guidancePath = String(input.convergenceGuidancePath ?? process.env.FLIXO_CONVERGENCE_GUIDANCE_PATH ?? '');
  const prior = cycle > 1 ? readJson(guidancePath) : null;
  if (cycle > 1 && !prior) fail('PRIOR_COUNTEREXAMPLE_REQUIRED', { cycle, guidancePath });
  const proposedStrategy = String(selected?.id ?? plan?.selected?.id ?? process.env.FLIXO_REPAIR_STRATEGY ?? 'NO_SAFE_MUTATION');

  const evidenceDigest = sha256(JSON.stringify({
    targetSha,
    failureFingerprint,
    failureLog: String(input.failureLog ?? '').slice(-16000),
    diagnosis: {
      rootCause: diagnosis?.rootCause ?? null,
      directFailureSignal,
      ambiguity: diagnosis?.ambiguity ?? null,
      location: diagnosis?.location ?? null
    },
    hypotheses,
    boundary,
    invariant,
    cycle,
    prior
  }));

  const manifest = {
    schemaVersion: 1,
    protocol: 'FLIXO-IN-REPO-REPAIR-V2',
    failure_signature: failureFingerprint,
    target_sha: targetSha,
    cycle,
    root_cause_analysis: {
      primary_cause: String(diagnosis?.rootCause ?? plan?.reasoning?.rootCause ?? selected?.id ?? 'UNKNOWN_RCA'),
      alternative_hypotheses: hypotheses,
      affected_boundaries: [boundary],
      invariant_violated: invariant,
      causal_chain: [
        'CI_FAILURE_EVENT',
        'TRACE_DISSECTION',
        'HYPOTHESIS_SYNTHESIS',
        'INVARIANT_IDENTIFICATION',
        'SURGICAL_PATCH',
        'ADVERSARIAL_FALSIFICATION',
        'TARGETED_REGRESSION',
        'EXACT_SHA_VERIFICATION'
      ]
    },
    proposed_fix: {
      strategy: proposedStrategy,
      isolation_level: 'SURGICAL_PATCH',
      scope: { max_source_files: 1, primary_file: boundary }
    },
    evidence: {
      exact_sha: actualSha === targetSha,
      direct_failure_signal: directFailureSignal,
      non_ambiguous: nonAmbiguous,
      evidence_digest: evidenceDigest,
      channels: diagnosis?.evidenceProfile?.channels ?? {},
      causal_confidence: Number(diagnosis?.causalConfidence ?? 0)
    },
    convergence: {
      search_space_strategy: 'EVIDENCE_BOUNDED',
      max_cycles: 3,
      prior_counterexample_required_after_cycle_1: true,
      prior_counterexample_digest: prior ? sha256(JSON.stringify(prior)) : null,
      prior_counterexample: prior?.convergenceDirective ?? prior?.convergence_directive ?? null
    },
    deterministic_proof: {
      status: 'PRE_MUTATION_BOUNDED',
      formula: 'EXACT_SHA && DIRECT_FAILURE_SIGNAL && NON_AMBIGUOUS_RCA && SINGLE_PRIMARY_BOUNDARY && THREE_HYPOTHESES && SURGICAL_PATCH'
    },
    generatedAt: new Date().toISOString()
  };
  validateRcaManifest(manifest, { policy, currentSha: actualSha });
  return Object.freeze(manifest);
}

export function validateRcaManifest(manifest, options = {}) {
  const policy = options.policy ?? loadPolicy();
  const currentSha = options.currentSha ?? null;
  const requireMutationEligible = options.requireMutationEligible !== false;
  if (!manifest || manifest.schemaVersion !== 1 || manifest.protocol !== 'FLIXO-IN-REPO-REPAIR-V2') fail('RCA_MANIFEST_HEADER_INVALID');
  if (!FP_RE.test(String(manifest.failure_signature ?? ''))) fail('RCA_FAILURE_SIGNATURE_INVALID');
  if (!SHA_RE.test(String(manifest.target_sha ?? ''))) fail('RCA_TARGET_SHA_INVALID');
  if (currentSha && manifest.target_sha !== currentSha) fail('RCA_MANIFEST_STALE');
  if (!Number.isInteger(manifest.cycle) || manifest.cycle < 1 || manifest.cycle > policy.maxRepairCycles) fail('RCA_CYCLE_INVALID');
  const root = manifest.root_cause_analysis;
  if (!root || !String(root.primary_cause ?? '').trim()) fail('RCA_PRIMARY_CAUSE_MISSING');
  if (!Array.isArray(root.alternative_hypotheses) || root.alternative_hypotheses.length !== 3) fail('RCA_THREE_HYPOTHESES_REQUIRED');
  if (new Set(root.alternative_hypotheses.map(function(item) { return String(item?.id ?? ''); })).size !== 3) fail('RCA_HYPOTHESES_NOT_DISTINCT');
  if (!Array.isArray(root.affected_boundaries) || root.affected_boundaries.length !== 1) fail('RCA_SINGLE_BOUNDARY_REQUIRED');
  if (!String(root.invariant_violated ?? '').trim() || /UNKNOWN_INVARIANT_UNPROVEN/iu.test(root.invariant_violated)) fail('RCA_INVARIANT_UNPROVEN');
  if (!Array.isArray(root.causal_chain) || root.causal_chain.length < 6) fail('RCA_CAUSAL_CHAIN_INCOMPLETE');
  if (manifest.proposed_fix?.isolation_level !== 'SURGICAL_PATCH') fail('RCA_SURGICAL_PATCH_REQUIRED');
  if (manifest.proposed_fix?.scope?.max_source_files !== 1) fail('RCA_MULTI_FILE_MUTATION_FORBIDDEN');
  if (policy.requireExactSha && manifest.evidence?.exact_sha !== true) fail('RCA_EXACT_SHA_REQUIRED');
  if (policy.requireDirectFailureSignal && manifest.evidence?.direct_failure_signal !== true) fail('RCA_DIRECT_FAILURE_REQUIRED');
  if (policy.requireNonAmbiguousRca && manifest.evidence?.non_ambiguous !== true) fail('RCA_NON_AMBIGUOUS_REQUIRED');
  if (manifest.convergence?.search_space_strategy !== 'EVIDENCE_BOUNDED') fail('RCA_SEARCH_SPACE_NOT_BOUNDED');
  if (manifest.convergence?.max_cycles !== 3) fail('RCA_MAX_CYCLES_INVALID');
  if (manifest.convergence?.prior_counterexample_required_after_cycle_1 !== true) fail('RCA_PRIOR_COUNTEREXAMPLE_POLICY_INVALID');
  if (requireMutationEligible && manifest.deterministic_proof?.status !== 'PRE_MUTATION_BOUNDED') fail('RCA_PRE_MUTATION_PROOF_REQUIRED');
  return Object.freeze({ status: 'PASS', mutationEligible: requireMutationEligible });
}

export function enforceMutationScope(input = {}) {
  const manifest = input.manifest;
  validateRcaManifest(manifest, { currentSha: manifest.target_sha, requireMutationEligible: true });
  const normalized = unique(input.changedPaths ?? []).map(function(value) {
    return value.replaceAll('\\\\', '/').replace(/^\.\//, '');
  });
  const source = normalized.filter(function(value) { return !value.startsWith('diagnostics/'); });
  if (source.length > 1) fail('MULTI_FILE_SOURCE_MUTATION_FORBIDDEN', source);
  if (source.length === 1 && source[0] !== manifest.proposed_fix.scope.primary_file) {
    fail('SURGICAL_PATCH_BOUNDARY_DRIFT', { expected: manifest.proposed_fix.scope.primary_file, actual: source[0] });
  }
  return { status: 'PASS', sourceFiles: source, maxSourceFiles: 1 };
}

export function generateCounterexamples(input = {}) {
  const manifest = input.manifest;
  const patch = String(input.patch ?? '');
  const changedPaths = unique(input.changedPaths ?? []);
  const source = changedPaths.filter(function(value) { return !value.startsWith('diagnostics/'); });
  const rejectionReason = input.rejectionReason ?? null;
  const cases = [
    {
      id: 'CE-EXACT-SHA',
      category: 'PROVENANCE',
      test_case: 'apply_candidate_against_a_superseded_target_sha',
      observed_behavior: rejectionReason?.code === 'TARGET_SHA_MISMATCH' ? String(rejectionReason.message ?? 'candidate SHA changed') : 'target SHA must remain immutable during the repair proof',
      expected_behavior: 'stale candidate is rejected before mutation or publication',
      target_invariant: 'exact SHA binding'
    }
  ];
  if (source.length > 1) {
    cases.push({
      id: 'CE-SCOPE-EXPANSION',
      category: 'SCOPE',
      test_case: 'mutate_two_source_files_when_single_file_scope_is_declared',
      observed_behavior: 'source mutation touched ' + source.length + ' files',
      expected_behavior: 'second source-file mutation is rejected',
      target_invariant: 'single-file surgical scope'
    });
  }
  if (FORBIDDEN_MUTATION_RE.test(patch)) {
    cases.push({
      id: 'CE-GATE-WEAKENING',
      category: 'SECURITY',
      test_case: 'introduce_a_gate_weakening_change',
      observed_behavior: 'patch contains a forbidden gate-weakening pattern',
      expected_behavior: 'mutation is rejected and no candidate may be published',
      target_invariant: 'gates remain fail-closed'
    });
  }
  const invariant = String(manifest?.root_cause_analysis?.invariant_violated ?? '').toLowerCase();
  if (/(lease|claim|concurr|atomic|lock)/u.test(invariant)) {
    cases.push({
      id: 'CE-DOUBLE-CLAIM',
      category: 'CONCURRENCY',
      test_case: 'simulate_two_claims_on_the_same_exclusive_state_transition',
      observed_behavior: 'two actors attempt the same mutation within one scheduling window',
      expected_behavior: 'the second claim is rejected by the atomic state guard',
      target_invariant: manifest.root_cause_analysis.invariant_violated
    });
  } else if (/(sha|stale|supersession|freshness)/u.test(invariant)) {
    cases.push({
      id: 'CE-STALE-SHA',
      category: 'PROVENANCE',
      test_case: 'replace_the_verified_sha_with_a_newer_branch_tip_before_commit',
      observed_behavior: 'branch tip changes after evidence capture',
      expected_behavior: 'stale evidence cannot authorize mutation or publication',
      target_invariant: manifest.root_cause_analysis.invariant_violated
    });
  } else {
    cases.push({
      id: 'CE-INVARIANT-PRESERVATION',
      category: 'SEMANTIC',
      test_case: 'perturb_the_guard_while_preserving_the_original_failure_shape',
      observed_behavior: 'a boundary guard is weakened while the original signature remains plausible',
      expected_behavior: 'the falsifier detects invariant violation and rejects the candidate',
      target_invariant: manifest.root_cause_analysis.invariant_violated
    });
  }
  return cases;
}

export function buildConvergenceDirective(input = {}) {
  const first = input.counterexamples?.[0] ?? null;
  const mapping = {
    'CE-EXACT-SHA': 'Bind every verification and mutation decision to the same immutable target SHA before any write.',
    'CE-SCOPE-EXPANSION': 'Reduce the patch to one primary source file and reject all secondary source mutations.',
    'CE-GATE-WEAKENING': 'Restore the original gate and move the repair to the smallest source-level guard that fixes the demonstrated failure.',
    'CE-DOUBLE-CLAIM': 'Introduce an atomic check-and-set or equivalent exclusive-state guard before the mutation transition.',
    'CE-STALE-SHA': 'Recompute all evidence on the newest exact SHA and reject any stale proof before mutation.',
    'CE-INVARIANT-PRESERVATION': 'Strengthen the smallest guard that directly preserves the declared invariant and re-run the falsifying edge case.'
  };
  return {
    mode: 'SEARCH_SPACE_REDUCTION',
    rejected: true,
    sourceCounterexample: first?.id ?? null,
    missing_guard: mapping[first?.id] ?? 'Strengthen the smallest guard that directly preserves the declared invariant.',
    target_invariant: first?.target_invariant ?? null,
    invariant_hint: input.rejectionReason?.message ?? first?.expected_behavior ?? null,
    next_cycle_requires: ['same_failure_fingerprint','same_or_newer_exact_sha','new_evidence','previous_counterexample_addressed']
  };
}

export function finiteInvariantProof(input = {}) {
  const manifest = input.manifest;
  const current = String(input.targetSha ?? '');
  const source = unique(input.changedPaths ?? []).filter(function(value) { return !String(value).startsWith('diagnostics/'); });
  const checks = {
    EXACT_SHA: manifest?.target_sha === current && SHA_RE.test(current),
    SINGLE_SOURCE_FILE: source.length <= 1,
    PRIMARY_BOUNDARY_MATCH: source.length === 0 || source[0] === manifest?.proposed_fix?.scope?.primary_file,
    NO_GATE_WEAKENING: !FORBIDDEN_MUTATION_RE.test(String(input.patch ?? '')),
    RCA_PROOF_FIELDS_PRESENT: Boolean(manifest?.root_cause_analysis?.primary_cause && manifest?.root_cause_analysis?.invariant_violated),
    ADVERSARIAL_PASS_CONFIRMED: input.adversarial?.falsifierVerdict === 'PASS_CONFIRMED'
  };
  const passed = Object.values(checks).every(Boolean);
  return Object.freeze({
    protocol: 'FLIXO-FINITE-INVARIANT-PROOF-v1',
    status: passed ? 'PROVEN' : 'BLOCKED',
    proofMode: 'FINITE_WITNESS_INVARIANT',
    formula: 'EXACT_SHA && SINGLE_SOURCE_FILE && PRIMARY_BOUNDARY_MATCH && NO_GATE_WEAKENING && RCA_PROOF_FIELDS_PRESENT && ADVERSARIAL_PASS_CONFIRMED',
    checks,
    witnessDigest: sha256(JSON.stringify({ manifest, targetSha: current, changedPaths: source, patch: String(input.patch ?? '').slice(0, 20000), adversarial: input.adversarial ?? null })),
    generatedAt: new Date().toISOString()
  });
}

export function buildFalsifierVerdict(input = {}) {
  const manifest = input.manifest;
  const counterexamples = generateCounterexamples(input);
  const reject = (input.actualFailures?.length ?? 0) > 0 || Number(input.mutantCasesSurvived ?? 0) > 0 || !manifest;
  if (reject) {
    return {
      falsifierVerdict: 'REJECTED_WITH_COUNTER_EXAMPLE',
      falsification_evidence: {
        test_case: input.actualFailures?.[0]?.label ?? counterexamples[0]?.test_case ?? 'deterministic_guard_perturbation',
        observed_behavior: input.actualFailures?.[0]?.stderr ?? input.actualFailures?.[0]?.stdout ?? counterexamples[0]?.observed_behavior ?? 'candidate failed an adversarial obligation',
        expected_behavior: counterexamples[0]?.expected_behavior ?? 'candidate must preserve the declared invariant',
        counterexamples
      },
      convergence_directive: buildConvergenceDirective(input),
      targetSha: input.targetSha ?? null
    };
  }
  return {
    falsifierVerdict: 'PASS_CONFIRMED',
    falsification_evidence: {
      test_case: 'deterministic_mutation_suite_and_targeted_regression',
      observed_behavior: 'all executed adversarial probes passed and no mutant survived',
      expected_behavior: 'all admissible perturbations are detected and the repair invariant remains proven',
      counterexamples: []
    },
    convergence_directive: null,
    targetSha: input.targetSha ?? null
  };
}

if (process.argv[1]?.endsWith('/in-repo-repair-v2.mjs')) {
  const command = process.argv[2] ?? 'validate-config';
  const policy = loadPolicy(process.env.FLIXO_REPAIR_V2_CONFIG ?? DEFAULT_CONFIG);
  if (command === 'validate-config') {
    console.log(JSON.stringify({ status: 'PASS', policy }, null, 2));
  } else if (command === 'rca') {
    const targetDir = process.env.FLIXO_TARGET_DIR ?? ROOT;
    const diagnosisPath = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';
    const strategyPath = process.env.FLIXO_REPAIR_STRATEGY_JSON ?? '/tmp/flixo-repair-strategy.json';
    const selectionPath = process.env.FLIXO_SELECTED_REPAIR_JSON ?? '/tmp/flixo-selected-repair-option.json';
    const outputPath = process.env.FLIXO_RCA_MANIFEST_PATH ?? '/tmp/flixo-rca-manifest.json';
    const manifest = buildRcaManifest({
      targetDir,
      targetSha: String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? git(targetDir, ['rev-parse', 'HEAD'])),
      failureFingerprint: String(process.env.FLIXO_FAILURE_FINGERPRINT ?? ''),
      failureLog: fs.existsSync(process.env.FLIXO_FAILURE_LOG ?? '') ? fs.readFileSync(process.env.FLIXO_FAILURE_LOG, 'utf8') : '',
      diagnosis: readJson(diagnosisPath),
      plan: readJson(strategyPath),
      selected: readJson(selectionPath),
      cycle: Number(process.env.FLIXO_REPAIR_ATTEMPT ?? 1),
      convergenceGuidancePath: process.env.FLIXO_CONVERGENCE_GUIDANCE_PATH ?? '',
      policy
    });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    fail('UNKNOWN_COMMAND', command);
  }
}
