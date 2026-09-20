import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { INTRACTABLE_THRESHOLD, fingerprintFailure } from './auto-repair-learning.mjs';
import { reasonFailure } from './auto-repair/reasoning.mjs';
import { buildCausalDiscriminator } from './action-causal-discriminator.mjs';
import { loadAttemptLedger, isRepairRejected, rejectionReasons } from './repair-attempt-ledger.mjs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
const intractablePath = process.env.FLIXO_INTRACTABLE_ERRORS ?? 'diagnostics/auto-repair/intractable-errors.json';
const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const chainId = String(process.env.FLIXO_REPAIR_CHAIN_ID ?? process.env.TARGET_RUN_ID ?? '').trim();
const caseFingerprint = String(process.env.FLIXO_FAILURE_FINGERPRINT ?? '').trim();
const attemptLedgerPath = process.env.FLIXO_REPAIR_ATTEMPT_LEDGER ?? '/tmp/flixo-repair-attempt-ledger.json';
const trainingPath = process.env.FLIXO_REPAIR_TRAINING_PATH ?? '/tmp/flixo-repair-training.json';

const strategies = [
  ['reproduce-exact', 'Reproduce the exact failure on the exact target SHA before changing source.'],
  ['minimize-failure', 'Reduce the failure to the smallest reproducible command, file, or test surface.'],
  ['diff-forensics', 'Inspect the target diff and recent history for the first causal change.'],
  ['environment-audit', 'Audit Node, package-lock, browser, OS, cache, and dependency/environment differences.'],
  ['workflow-forensics', 'Inspect workflow ordering, permissions, concurrency, artifacts, and CI-only assumptions.'],
  ['observability-trace', 'Add bounded diagnostic evidence or tracing without changing the acceptance criteria.'],
  ['historical-analogy', 'Compare prior successful and rejected cases, lessons, anti-lessons, and playbooks.'],
  ['synthetic-reproduction', 'Build a minimal synthetic reproduction or focused regression test for the suspected root cause.'],
  ['alternate-hypothesis', 'Reject the leading hypothesis and test a materially different evidence-backed repair hypothesis.'],
  ['supervising-escalation', 'Prepare a complete teaching packet for the supervising agent; do not repeat prior repairs.'],
 ];

const VALID_STRATEGY_IDS = new Set(strategies.map(([id]) => id));

function readJson(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}

const ROOT_CAUSE_METHODS = Object.freeze({
  lint: ['source-line-isolation', 'symbol-usage-trace', 'minimal-ast-repair'],
  format: ['format-only-repro', 'generated-source-check', 'formatter-config-provenance'],
  typescript: ['diagnostic-chain', 'import-export-lineage', 'type-boundary-isolation'],
  'typescript-async-contract': ['promise-contract-trace', 'await-propagation', 'return-boundary-isolation'],
  playwright: ['browser-minimal-repro', 'lifecycle-barrier-trace', 'cross-browser-differential'],
  'webkit-render': ['frame-completion-trace', 'gpu-state-observation', 'cross-browser-differential'],
  build: ['dependency-graph-trace', 'generated-artifact-diff', 'clean-build-repro'],
  certification: ['evidence-lineage-audit', 'semantic-identity-trace', 'fresh-sha-revalidation'],
  'contract-drift': ['canonical-source-trace', 'validator-vs-runtime-diff', 'contract-owner-audit'],
  'liveness-contract': ['state-machine-trace', 'lease-transition-audit', 'stale-session-falsification'],
  'noncanonical-automation': ['dispatch-owner-trace', 'duplicate-trigger-audit', 'workflow-authority-falsification'],
  'external-tooling': ['provider-isolation', 'source-mutation-ban', 'external-recovery-revalidation'],
  unknown: ['exact-reproduction', 'broad-causal-scan', 'supervising-escalation'],
});

const STRATEGY_FAMILIES = Object.freeze({
  'reproduce-exact': ['lint', 'format', 'typescript', 'typescript-async-contract', 'playwright', 'webkit-render', 'build'],
  'minimize-failure': ['lint', 'format', 'typescript', 'playwright', 'build'],
  'diff-forensics': ['typescript', 'build', 'contract-drift', 'certification'],
  'environment-audit': ['typescript', 'build', 'playwright', 'webkit-render', 'external-tooling'],
  'workflow-forensics': ['noncanonical-automation', 'liveness-contract', 'contract-drift', 'certification', 'external-tooling'],
  'observability-trace': ['playwright', 'webkit-render', 'liveness-contract', 'certification'],
  'historical-analogy': ['lint', 'format', 'typescript', 'build', 'playwright', 'webkit-render', 'certification', 'contract-drift'],
  'synthetic-reproduction': ['lint', 'typescript', 'playwright', 'webkit-render', 'build', 'contract-drift'],
  'alternate-hypothesis': ['lint', 'format', 'typescript', 'playwright', 'webkit-render', 'build', 'certification', 'contract-drift', 'liveness-contract'],
  'supervising-escalation': ['unknown', 'external-tooling', 'certification', 'contract-drift', 'liveness-contract'],
});

const SECURITY_PATTERNS = Object.freeze([
  { id: 'workflow-input-taint', pattern: /github\.event\.inputs\.[A-Za-z0-9_]+[^\n]*run:|\$\{\{\s*inputs\.[A-Za-z0-9_]+\s*\}\}/iu, className: 'INPUT_TAINT', severity: 'HIGH' },
  { id: 'env-taint', pattern: /GITHUB_ENV[^\n]*\$[A-Z_][A-Z0-9_]*|echo\s+.*>>\s*\$GITHUB_ENV/iu, className: 'ENV_TAINT', severity: 'HIGH' },
  { id: 'artifact-boundary', pattern: /download-artifact|gh\s+run\s+download/iu, className: 'ARTIFACT_PROVENANCE', severity: 'HIGH' },
  { id: 'workflow-write', pattern: /permissions:[\s\S]{0,600}contents:\s*write|permissions:\s*write-all/iu, className: 'TOKEN_WRITE', severity: 'MEDIUM' },
  { id: 'targeted-comment-api', pattern: /gh\s+issue\s+comment|issues\/\d+\/comments/iu, className: 'COMMENT_TRANSPORT', severity: 'MEDIUM' },
  { id: 'pull-request-target', pattern: /pull_request_target/iu, className: 'TRUSTED_WORKFLOW_BOUNDARY', severity: 'CRITICAL' },
]);

function canonicalSecuritySurface(targetDir) {
  const findings = [];
  const roots = ['.github/workflows', 'scripts/ci'];
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  for (const root of roots) {
    const absolute = targetDir.replace(/[/\\]$/u, '') + '/' + root;
    if (!fs.existsSync(absolute)) continue;
    const names = fs.readdirSync(absolute).filter((name) => /\.(?:ya?ml|mjs|js|ts)$/u.test(name));
    for (const name of names.slice(0, root === '.github/workflows' ? 80 : 120)) {
      const file = absolute + '/' + name;
      let source;
      try { source = fs.readFileSync(file, 'utf8'); } catch { continue; }
      for (const rule of SECURITY_PATTERNS) {
        if (!rule.pattern.test(source)) continue;
        findings.push({ id: rule.id, className: rule.className, severity: rule.severity, path: root + '/' + name, status: 'SIGNAL_REQUIRES_REVIEW' });
      }
    }
  }
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.path.localeCompare(b.path) || a.id.localeCompare(b.id)).slice(0, 40);
}

function stateActionTrainingRecommendation(training, rootCause, features, attempt, previousStrategy, rejected=[]) {
  const competent = training?.decision?.stateActionTraining?.competent === true
    && training?.decision?.eligibleToInfluenceRouting === true;
  if (!competent) return null;
  const featureSignature = [...new Set((features ?? []).map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean))].sort().join(',');
  const attemptNumber = Math.max(0, Number(attempt) || 0);
  const bucket = attemptNumber === 0 ? 'a0' : attemptNumber === 1 ? 'a1' : attemptNumber <= 3 ? 'a2_3' : attemptNumber <= 7 ? 'a4_7' : 'a8_plus';
  const previous = String(previousStrategy ?? 'START').toLowerCase();
  const root = String(rootCause ?? 'unknown').toLowerCase();
  const keys = [
    [root, featureSignature, bucket, previous].join('|'),
    [root, featureSignature, 'a0', previous].join('|'),
    [root, '', bucket, previous].join('|'),
    [root, '', '', previous].join('|'),
  ];
  for (const key of keys) {
    const candidate = (training?.stateModel?.policy?.[key] ?? []).find((item) => !rejected.includes(item.strategyId));
    if (candidate) return { ...candidate, stateKey: key };
  }
  return null;
}

function behavioralTrainingRecommendation(training, rootCause, previousStrategy, rejected=[]) {
  const list=training?.behaviorModel?.transitions?.[[String(rootCause??'unknown').toLowerCase(),String(previousStrategy??'START').toLowerCase()].join('|')] ?? [];
  return list.find((item)=>!rejected.includes(item.strategyId)) ?? null;
}

function chooseNextEvidenceStrategy(causal, rejectedStrategies = [], priorStrategies = []) {
  const map = {
    lint: ['reproduce-exact','diff-forensics','minimize-failure'],
    format: ['reproduce-exact','diff-forensics','environment-audit'],
    typescript: ['reproduce-exact','diff-forensics','synthetic-reproduction'],
    'typescript-async-contract': ['reproduce-exact','diff-forensics','synthetic-reproduction'],
    playwright: ['reproduce-exact','synthetic-reproduction','observability-trace'],
    'webkit-render': ['reproduce-exact','observability-trace','synthetic-reproduction'],
    build: ['reproduce-exact','environment-audit','diff-forensics'],
    certification: ['reproduce-exact','workflow-forensics','observability-trace'],
    'contract-drift': ['diff-forensics','workflow-forensics','reproduce-exact'],
    'liveness-contract': ['workflow-forensics','observability-trace','reproduce-exact'],
    'noncanonical-automation': ['workflow-forensics','diff-forensics','observability-trace'],
    'external-tooling': ['environment-audit','workflow-forensics','reproduce-exact'],
    unknown: ['reproduce-exact','minimize-failure','diff-forensics'],
  };
  const source = map[String(causal?.rootCause ?? 'unknown').toLowerCase()] ?? map.unknown;
  const excluded = new Set([...(rejectedStrategies ?? []), ...(priorStrategies ?? []).slice(-3)]);
  const candidates = [...source, ...map.unknown]
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => !excluded.has(id));
  const chosen = candidates[0] ?? 'reproduce-exact';
  return {
    strategyId: chosen,
    alternatives: candidates.slice(1,4),
    rationale: 'EVIDENCE_INFORMATION_GAIN_BY_ROOT_CAUSE',
    source: 'DETERMINISTIC_EVIDENCE_ROUTER',
  };
}

function trainingAbstentionDecision(training, causal, stateActionRecommendation, behavioralRecommendation) {
  const eligible = training?.decision?.eligibleToInfluenceRouting === true;
  if (!eligible) return { eligible: false, abstain: false, mode: 'TRAINING_UNAVAILABLE', confidence: 0, threshold: null, reason: 'TRAINING_NOT_ELIGIBLE', nextEvidence: null };
  const threshold = Number(training?.decision?.calibration?.recommendedAbstentionThreshold ?? training?.calibration?.abstention?.recommendedThreshold ?? 0.75);
  const activePolicy = training?.activePolicy ?? training?.policy;
  const contextual = activePolicy?.byRootCause?.[String(causal.rootCause ?? 'unknown').toLowerCase()]?.[0] ?? null;
  const trainedConfidence = Number(stateActionRecommendation?.confidence ?? behavioralRecommendation?.confidence ?? contextual?.confidence ?? contextual?.successRate ?? 0);
  const causalConfidence = Number(causal?.confidence ?? 0);
  const ambiguous = causal?.ambiguity === true;
  const lowConfidence = trainedConfidence < threshold || causalConfidence < 0.55;
  const abstain = ambiguous || lowConfidence;
  const reasons = [];
  if (ambiguous) reasons.push('CAUSAL_AMBIGUITY');
  if (trainedConfidence < threshold) reasons.push('TRAINING_CONFIDENCE_BELOW_THRESHOLD');
  if (causalConfidence < 0.55) reasons.push('CAUSAL_CONFIDENCE_BELOW_THRESHOLD');
  return {
    eligible: true,
    abstain,
    mode: abstain ? 'COLLECT_MORE_EVIDENCE' : 'TRAINED_ROUTING',
    confidence: Number(trainedConfidence.toFixed(4)),
    causalConfidence: Number(causalConfidence.toFixed(4)),
    threshold: Number(threshold.toFixed(4)),
    reason: reasons.join('|') || 'CONFIDENCE_SUFFICIENT',
  };
}

function strategyTrainingStats(training, id, rootCause) {
  const global = training?.policy?.global?.[id] ?? {};
  const contextual = training?.policy?.byRootCause?.[rootCause]?.find((item) => item.strategyId === id) ?? null;
  return {
    successRate: Number(contextual?.successRate ?? global.successRate ?? 0),
    observations: Number(contextual?.observations ?? global.observations ?? 0),
    confidence: Number(contextual?.confidence ?? (global.trained ? 0.65 : 0)),
  };
}

function strategyOutcomeStats(memory, id, rootCause) {
  let successes = 0;
  let failures = 0;
  let observations = 0;
  let contextual = 0;
  for (const entry of memory.cases ?? []) {
    for (const outcome of entry.outcomes ?? []) {
      if (outcome?.provenance?.strategyId !== id) continue;
      if (outcome.outcome === 'blocked-external') continue;
      if (!['success', 'failure', 'unrepaired', 'blocked', 'reverted-repair'].includes(outcome.outcome)) continue;
      observations += 1;
      if (outcome.outcome === 'success') successes += 1; else failures += 1;
      if (rootCause && entry.rootCause === rootCause) contextual += 1;
    }
  }
  return { successes, failures, observations, contextual };
}

function causalIntelligence(log, memory, stableCaseFingerprint, targetDir) {
  let reasoning;
  try {
    reasoning = reasonFailure(log, {
      targetDir,
      historical: (memory.cases ?? []).map((entry) => ({ rootCause: entry.rootCause, successes: entry.successes, attempts: entry.attempts })),
    });
  } catch {
    reasoning = null;
  }
  let discriminator;
  try {
    discriminator = buildCausalDiscriminator({
      failureLog: log,
      exactCases: (memory.cases ?? []).filter((entry) => entry.fingerprint === stableCaseFingerprint),
      doNotRepeat: [...new Set((memory.cases ?? []).filter((entry) => entry.fingerprint === stableCaseFingerprint).flatMap((entry) => [...(entry.revertedRules ?? []), ...(entry.failedStrategies ?? [])]))],
      fingerprint: stableCaseFingerprint,
      targetSha: process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? '',
    });
  } catch {
    discriminator = null;
  }
  const rootCause = String(reasoning?.rootCause ?? discriminator?.hypotheses?.[0]?.id ?? 'unknown');
  const rootMethods = ROOT_CAUSE_METHODS[rootCause] ?? ROOT_CAUSE_METHODS.unknown;
  return Object.freeze({
    version: 'V13-BEHAVIORAL-TRAINING',
    rootCause,
    features: reasoning?.features ?? discriminator?.features ?? [],
    confidence: Number(reasoning?.causalConfidence ?? 0),
    ambiguity: reasoning?.ambiguity === true || discriminator?.ranking?.ambiguous === true,
    decision: reasoning?.decision ?? discriminator?.decision ?? 'PROPOSE_ONLY',
    mutationAllowed: reasoning?.sourceMutationAllowed === true && discriminator?.failClosed !== true,
    rootMethods,
    topHypotheses: (reasoning?.hypotheses ?? discriminator?.hypotheses ?? []).slice(0, 5).map((item) => ({
      id: item.id,
      score: item.score ?? item.evidenceScore ?? null,
      evidenceAnchors: item.directMatches ?? item.evidenceAnchors ?? 0,
      suppressedBy: item.suppressedBy ?? null,
    })),
    falsification: (reasoning?.falsificationChecks ?? []).slice(0, 8),
    evidenceProfile: reasoning?.evidenceProfile ?? null,
    discriminatorScore: discriminator?.capabilityScore ?? null,
    stableFingerprint: stableCaseFingerprint || null,
  });
}

function rankIntelligentStrategies({ memory, causal, rejected, priorStrategies, twinPreferredStrategy, training }) {
  const ranked = strategies.map(([id, description], order) => {
    const stats = strategyOutcomeStats(memory, id, causal.rootCause);
    const trainingStats = strategyTrainingStats(training, id, causal.rootCause);
    const familyMatch = (STRATEGY_FAMILIES[id] ?? []).includes(causal.rootCause) ? 1 : 0;
    const rejectionPenalty = rejected.has(id) ? 1 : 0;
    const repeatCount = priorStrategies.filter((value) => value === id).length;
    const successRate = stats.observations ? stats.successes / stats.observations : 0;
    const empiricalSignal = Math.min(1, stats.observations / 6);
    const contextualSignal = stats.observations ? Math.min(1, stats.contextual / stats.observations) : 0;
    const twinSignal = twinPreferredStrategy === id ? 1 : 0;
    const evidenceSignal = causal.rootCause !== 'unknown' ? familyMatch : id === 'supervising-escalation' ? 1 : 0;
    const trainingSignal = Math.min(1, trainingStats.successRate * Math.min(1, trainingStats.observations / 4) * Math.max(0.35, trainingStats.confidence));
    const score = evidenceSignal * 0.28 + contextualSignal * 0.16 + successRate * 0.16 + empiricalSignal * 0.08 + trainingSignal * 0.16 + twinSignal * 0.08 - Math.min(0.24, repeatCount * 0.06) - rejectionPenalty * 0.70;
    return {
      id, description, order, score: Number(score.toFixed(5)), rootCause: causal.rootCause,
      familyMatch: Boolean(familyMatch), twinPreferred: twinSignal === 1,
      observations: stats.observations, successes: stats.successes, failures: stats.failures,
      successRate: Number(successRate.toFixed(4)), contextualRate: Number(contextualSignal.toFixed(4)),
      trainingSuccessRate: trainingStats.successRate, trainingObservations: trainingStats.observations, trainingConfidence: trainingStats.confidence, trainingSignal: Number(trainingSignal.toFixed(4)),
      repeatCount, rejected: rejectionPenalty === 1,
    };
  })
    .filter((item) => !item.rejected)
    .sort((a, b) => b.score - a.score || a.repeatCount - b.repeatCount || a.order - b.order);
  const portfolio = ranked.slice(0, 4);
  return {
    ranked: ranked.slice(0, 8),
    portfolio,
    selected: portfolio[0] ?? null,
    runnerUp: portfolio[1] ?? null,
    separation: portfolio[1] ? Number((portfolio[0].score - portfolio[1].score).toFixed(5)) : 1,
    exploration: portfolio.slice(1).map((item, index) => ({
      phase: index + 1,
      strategyId: item.id,
      purpose: index === 0 ? 'STRONGEST_ALTERNATIVE' : index === 1 ? 'INDEPENDENT_DIAGNOSTIC' : 'RECOVERY_ESCALATION',
    })),
  };
}

function buildFalsificationPlan(causal, strategyRanking) {
  const top = causal.topHypotheses?.[0] ?? null;
  const runner = causal.topHypotheses?.find((item) => item.id !== top?.id && !item.suppressedBy) ?? null;
  return [
    { id: 'HYPOTHESIS_SEPARATION', action: 'Disprove the strongest competing hypothesis before mutation.', target: runner?.id ?? 'UNKNOWN' },
    { id: 'MECHANISM_PROOF', action: 'Show trigger -> propagation -> causal source -> symptom.', target: top?.id ?? causal.rootCause },
    { id: 'SOURCE_OWNERSHIP', action: 'Verify the proposed file is the canonical causal owner.', target: 'canonical-source' },
    { id: 'REGRESSION_CAUSALITY', action: 'Run the smallest failing regression before and twice after repair.', target: causal.rootMethods?.[0] ?? 'exact-reproduction' },
    { id: 'SECURITY_BOUNDARY', action: 'Audit input, artifact, permission, environment and token boundaries touched by the repair.', target: 'security-surface' },
    { id: 'RECURRENCE_GUARD', action: 'Reject a repeated strategy without materially new evidence.', target: strategyRanking.selected?.id ?? 'none' },
  ];
}
const ROOT_CAUSE_REPAIR_RULES = Object.freeze({
  lint: ['eslint-unused', 'prepared-source-change'],
  format: ['prettier-file', 'prepared-source-change'],
  typescript: ['typescript-missing-import', 'prepared-source-change', 'typescript-diagnostic'],
  'typescript-async-contract': ['typescript-async-contract', 'prepared-source-change'],
  playwright: ['playwright-diagnostic'],
  'webkit-render': ['webkit-proposal'],
  build: ['build-diagnostic'],
  certification: ['certification-proposal'],
  'contract-drift': [],
  'noncanonical-automation': [],
  'liveness-contract': [],
  'external-tooling': [],
  unknown: [],
});

const STRATEGY_FOCUS = Object.freeze({
  'reproduce-exact': 'REPRODUCE_EXACT_FAILURE',
  'minimize-failure': 'MINIMIZE_TO_SMALLEST_CAUSAL_SURFACE',
  'diff-forensics': 'TRACE_FIRST_CAUSAL_CHANGE',
  'environment-audit': 'ISOLATE_RUNTIME_AND_DEPENDENCY_CAUSE',
  'workflow-forensics': 'TRACE_WORKFLOW_AUTHORITY_AND_TRANSPORT',
  'observability-trace': 'TRACE_TRIGGER_PROPAGATION_AND_SYMPTOM',
  'historical-analogy': 'COMPARE_VERIFIED_PRIORS_WITH_CURRENT_EXACT_SHA',
  'synthetic-reproduction': 'BUILD_MINIMAL_CAUSAL_REPRODUCTION',
  'alternate-hypothesis': 'FALSIFY_STRONGEST_COMPETING_HYPOTHESIS',
  'supervising-escalation': 'ESCALATE_WITH_NEW_EVIDENCE_AND_TEACHING_PACKET',
});

function buildSteeringDirective({ causal, strategyId, ranking, targetSha, fingerprint: failureFingerprint }) {
  const mutationAllowed = causal.decision === 'ALLOW_BOUNDED_MUTATION'
    && causal.mutationAllowed === true
    && causal.ambiguity === false
    && causal.confidence >= 0.75;
  const steeringMode = causal.decision === 'BLOCK_EXTERNAL'
    ? 'EXTERNAL_ISOLATION'
    : mutationAllowed
      ? 'BOUNDED_SOURCE_REPAIR'
      : 'EVIDENCE_ONLY';
  const preferredRepairRules = mutationAllowed
    ? (ROOT_CAUSE_REPAIR_RULES[causal.rootCause] ?? [])
    : [];
  const route = steeringMode === 'EXTERNAL_ISOLATION'
    ? ['CLASSIFY_PROVIDER', 'ISOLATE_EXTERNAL', 'NO_SOURCE_MUTATION', 'REVALIDATE_PROVIDER']
    : steeringMode === 'BOUNDED_SOURCE_REPAIR'
      ? ['CAPTURE', 'REPRODUCE', 'FALSIFY', 'TRACE_CANONICAL_OWNER', 'SELECT_REPAIR_RULE', 'MUTATE_SOURCE_ONCE', 'TARGETED_REGRESSION', 'CANONICAL_CI', 'LEARN']
      : ['CAPTURE', 'REPRODUCE_OR_DISPROVE', 'FALSIFY', 'TRACE_CANONICAL_OWNER', 'EXPAND_EVIDENCE', 'REDISPATCH'];
  return Object.freeze({
    schemaVersion: 1,
    authority: 'DETERMINISTIC_REPAIR_STEERING',
    exactShaRequired: true,
    targetSha: targetSha || null,
    failureFingerprint: failureFingerprint || null,
    rootCause: causal.rootCause,
    causalConfidence: causal.confidence,
    decision: causal.decision,
    steeringMode,
    strategyId,
    focus: STRATEGY_FOCUS[strategyId] ?? 'EVIDENCE_FIRST_CAUSAL_REASONING',
    primaryMethod: causal.rootMethods?.[0] ?? 'exact-reproduction',
    preferredRepairRules,
    rankedAlternatives: (ranking?.portfolio ?? []).map((item) => item.id),
    route,
    mutation: {
      allowed: steeringMode === 'BOUNDED_SOURCE_REPAIR',
      authority: 'REPAIR_ENGINE_ONLY',
      scope: 'SOURCE_FILES_DIRECTLY_BOUND_TO_CURRENT_FAILURE',
      maxSourceMutationPassesPerCycle: 1,
      noControlPlaneMutation: true,
    },
    verification: {
      targetedRequired: true,
      canonicalGreenRequired: true,
      exactShaRequired: true,
      regressionBeforePublication: true,
    },
    escalation: {
      onAmbiguity: 'EVIDENCE_ONLY',
      onExternal: 'EXTERNAL_ISOLATION',
      onStall: 'REQUIRES_NEW_EVIDENCE_AND_NEW_STRATEGY',
      terminalOnly: 'CANONICAL_GREEN',
    },
  });
}
function priorRepairArtifactCount() {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const targetRunId = process.env.TARGET_RUN_ID;
  if (!token || !repo || !targetRunId) return 0;
  const result = spawnSync('gh', ['api', `repos/${repo}/actions/artifacts`, '--paginate', '--slurp', '--jq', '.[].artifacts[].name'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) return 0;
  const prefix = `flixo-auto-repair-${targetRunId}-`;
  return result.stdout.split('\n').filter((name) => name.startsWith(prefix)).length;
}

const twinProposalPath = process.env.FLIXO_TWIN_PROPOSAL_PATH ?? '';
const twinProposal = twinProposalPath ? readJson(twinProposalPath, null) : null;
const twinA = process.env.FLIXO_TWIN_A_PATH ? readJson(process.env.FLIXO_TWIN_A_PATH, null) : null;
const twinB = process.env.FLIXO_TWIN_B_PATH ? readJson(process.env.FLIXO_TWIN_B_PATH, null) : null;
const twinSelection = process.env.FLIXO_SELECTION_PATH ? readJson(process.env.FLIXO_SELECTION_PATH, null) : null;
const selectedRepairStrategy = String(twinSelection?.selection?.selectedStrategy ?? '').trim();
if (selectedRepairStrategy && !VALID_STRATEGY_IDS.has(selectedRepairStrategy)) {
  throw new Error('TWIN_SELECTED_STRATEGY_NOT_ALLOWLISTED');
}
const twinPreferredStrategy = selectedRepairStrategy
  || String(twinProposal?.challenge?.preferredAlternativeStrategy ?? twinA?.challenge?.preferredAlternativeStrategy ?? twinB?.challenge?.preferredAlternativeStrategy ?? '').trim();
const memory = readJson(memoryPath, { cases: [] });
const training = readJson(trainingPath, null);
const intractable = readJson(intractablePath, { cases: [] });
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const fingerprint = fingerprintFailure(log);
const attemptLedger = loadAttemptLedger(attemptLedgerPath, { chainId });
const stableCaseFingerprint = caseFingerprint || attemptLedger.caseFingerprint || fingerprint;
attemptLedger.caseFingerprint = stableCaseFingerprint;
const entry = (memory.cases ?? []).find((item) => item.fingerprint === fingerprint);
const record = (intractable.cases ?? []).find((item) => item.fingerprint === fingerprint);
const attempts = Number(entry?.attempts ?? 0);
const persistedAttempts = priorRepairArtifactCount();
const nextAttempt = Math.max(attempts + 1, persistedAttempts + 1);
const priorStrategies = [
  ...(entry?.outcomes ?? []).map((item) => item?.provenance?.strategyId).filter(Boolean),
  ...(entry?.rejectedStrategies ?? []),
  ...(entry?.strategies ?? []),
].map(String);
const rejected = new Set([
  ...(entry?.revertedRules ?? []),
  ...(rejectionReasons(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint }).map((item) => item?.strategyId)),
].filter(Boolean).map(String));
const causal = causalIntelligence(log, memory, stableCaseFingerprint, process.cwd());
const securityFindings = canonicalSecuritySurface(process.cwd());
const behavioralPreviousStrategy = priorStrategies.at(-1) ?? 'START';
const stateActionRecommendation = stateActionTrainingRecommendation(training, causal.rootCause, causal.features, Math.max(0, nextAttempt - 1), behavioralPreviousStrategy, [...rejected]);
const behavioralRecommendation = behavioralTrainingRecommendation(training, causal.rootCause, behavioralPreviousStrategy, [...rejected]);
const intelligentRanking = rankIntelligentStrategies({ memory, causal, rejected, priorStrategies, twinPreferredStrategy, training });
const unusedIndexes = strategies.map((_, i) => i).filter((i) => !priorStrategies.includes(strategies[i][0])).filter((i) => !rejected.has(strategies[i][0]));
const ledgerAvailableIndexes = unusedIndexes.filter((i) => !isRepairRejected(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint, strategyId: strategies[i][0] }));
const divergentIndexes = ledgerAvailableIndexes.filter((i) => strategies[i][0] !== twinPreferredStrategy);
const allStrategiesExhausted = ledgerAvailableIndexes.length === 0;
const rotationIndexes = strategies.map((_, i) => i).filter((i) => !twinPreferredStrategy || strategies[i][0] !== twinPreferredStrategy);
const availableIndexes = allStrategiesExhausted ? (rotationIndexes.length ? rotationIndexes : strategies.map((_, i) => i)) : ledgerAvailableIndexes;
const selectedIndex = selectedRepairStrategy ? strategies.findIndex(([id]) => id === selectedRepairStrategy) : -1;
const intelligentSelectedId = intelligentRanking.selected?.id ?? null;
const stateActionPreferredId = stateActionRecommendation?.strategyId ?? null;
const behaviorPreferredId = behavioralRecommendation?.strategyId ?? null;
const intelligentIndex = intelligentSelectedId ? strategies.findIndex(([id]) => id === intelligentSelectedId) : -1;
const stateActionIndex = stateActionPreferredId ? strategies.findIndex(([id]) => id === stateActionPreferredId) : -1;
const behaviorIndex = behaviorPreferredId ? strategies.findIndex(([id]) => id === behaviorPreferredId) : -1;
const trainingAbstention = trainingAbstentionDecision(training, causal, stateActionRecommendation, behavioralRecommendation);
const nextEvidence = trainingAbstention.abstain
  ? chooseNextEvidenceStrategy(causal, [...rejected], priorStrategies)
  : null;
const trainingDecision = Object.freeze({ ...trainingAbstention, nextEvidence });
const evidenceFirstIds = ['reproduce-exact','minimize-failure','diff-forensics','workflow-forensics','observability-trace'];
const evidenceFirstIndexes = evidenceFirstIds
  .map((id) => strategies.findIndex(([strategyId]) => strategyId === id))
  .filter((candidateIndex) => candidateIndex >= 0 && availableIndexes.includes(candidateIndex));
const nextEvidenceIndex = trainingDecision.nextEvidence?.strategyId
  ? strategies.findIndex(([strategyId]) => strategyId === trainingDecision.nextEvidence.strategyId)
  : -1;
const index = selectedIndex >= 0 && availableIndexes.includes(selectedIndex)
  ? selectedIndex
  : trainingDecision.abstain && nextEvidenceIndex >= 0 && availableIndexes.includes(nextEvidenceIndex)
    ? nextEvidenceIndex
  : trainingDecision.abstain && evidenceFirstIndexes.length
    ? evidenceFirstIndexes[0]
    : stateActionIndex >= 0 && availableIndexes.includes(stateActionIndex)
      ? stateActionIndex
      : behaviorIndex >= 0 && availableIndexes.includes(behaviorIndex)
      ? behaviorIndex
      : intelligentIndex >= 0 && availableIndexes.includes(intelligentIndex)
      ? intelligentIndex
      : (divergentIndexes[0] ?? availableIndexes[(Math.max(0, nextAttempt - 1)) % availableIndexes.length]);
const [strategyId, strategy] = strategies[index];
const threshold = INTRACTABLE_THRESHOLD;
const teachingEscalation = record?.status === 'INTRACTABLE' || nextAttempt > threshold || allStrategiesExhausted;
const sameStrategyRepeated = priorStrategies.filter((value) => value === strategyId).length > 0;
const steeringDirective = buildSteeringDirective({
  causal,
  strategyId,
  ranking: intelligentRanking,
  targetSha: process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? '',
  fingerprint: stableCaseFingerprint,
});

const decisionTracePayload = {
  schemaVersion: 1,
  authority: 'REPLAYABLE_REPAIR_DECISION_TRACE',
  targetSha: process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? null,
  failureFingerprint: stableCaseFingerprint,
  causalRootCause: causal.rootCause,
  causalConfidence: causal.confidence,
  causalFeatures: [...(causal.features ?? [])].map(String).sort(),
  attempt: nextAttempt,
  previousStrategy: behavioralPreviousStrategy,
  rejectedStrategies: [...rejected].map(String).sort(),
  training: {
    mode: training?.decision?.mode ?? 'MISSING',
    eligible: trainingDecision.eligible,
    abstain: trainingDecision.abstain,
    confidence: trainingDecision.confidence,
    threshold: trainingDecision.threshold,
    nextEvidenceStrategy: trainingDecision.nextEvidence?.strategyId ?? null,
    activePolicyHash: training?.trainingProvenance?.activePolicyHash ?? training?.decision?.policyLifecycle?.activePolicyHash ?? null,
  },
  decision: {
    selectedStrategy: strategyId,
    selectedBy: selectedRepairStrategy ? 'TWIN_OR_EXTERNAL_SELECTION' : trainingDecision.abstain ? 'TRAINING_ABSTENTION_EVIDENCE_ROUTER' : stateActionPreferredId ? 'TRAINED_STATE_ACTION' : behaviorPreferredId ? 'TRAINED_BEHAVIOR_SEQUENCE' : intelligentSelectedId ? 'V12_CAUSAL_PORTFOLIO' : 'DETERMINISTIC_ROTATION',
  },
};
const decisionTrace = {
  ...decisionTracePayload,
  traceHash: createHash('sha256').update(JSON.stringify(decisionTracePayload), 'utf8').digest('hex'),
};
if (allStrategiesExhausted) {
  console.log(JSON.stringify({
    strategyRotation: 'FULL_ROTATION_AFTER_EXHAUSTION',
    attempt: nextAttempt,
    priorStrategies: [...new Set(priorStrategies)].slice(-20),
    selectedStrategy: strategyId,
    evidenceRequired: true,
  }));
}
const teachingPacket = {
  state: teachingEscalation ? 'SUPERVISING_TEACHING_REQUIRED' : 'LEARNING_CONTEXT_REQUIRED',
  attempt: nextAttempt,
  priorStrategies: [...new Set(priorStrategies)].slice(-20),
  doNotRepeat: [...new Set([...(entry?.revertedRules ?? []), ...(entry?.rules ?? [])])].slice(-20),
  requiredHypothesisChange: teachingEscalation,
  requiredEvidenceDelta: teachingEscalation ? ['new-root-cause-evidence', 'new-reproduction-or-disproof', 'new-verification-proof'] : ['exact-failure-evidence'],
  exitCriteria: 'verified-repair-on-exact-target-sha-and-canonical-green',
  intelligence: {
    version: 'V13-BEHAVIORAL-TRAINING',
    causal,
    strategyPortfolio: intelligentRanking.portfolio,
    falsificationPlan: buildFalsificationPlan(causal, intelligentRanking),
    securitySignals: securityFindings,
    training,
    stateActionRecommendation,
    behavioralRecommendation,
    selectedBy: selectedRepairStrategy ? 'TWIN_OR_EXTERNAL_SELECTION' : stateActionPreferredId ? 'TRAINED_STATE_ACTION' : behaviorPreferredId ? 'TRAINED_BEHAVIOR_SEQUENCE' : intelligentSelectedId ? 'V12_CAUSAL_PORTFOLIO' : 'DETERMINISTIC_ROTATION',
    noBlindRepeat: true,
    trainingDecision,
    nextEvidence,
    decisionTrace,
    steering: steeringDirective,
  },
};

fs.writeFileSync('/tmp/flixo-repair-strategy.json', `${JSON.stringify({
  fingerprint,
  stableCaseFingerprint,
  chainId: chainId || null,
  attempt: nextAttempt,
  priorRepairArtifacts: persistedAttempts,
  rejectedByDurableLedger: rejectionReasons(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint }).slice(-20),
  strategyId,
  strategy,
  intractable: false,
  teachingEscalation,
  sameStrategyRepeated,
  teachingPacket,
  intelligence: {
    version: 'V12',
    causal,
    rankedStrategies: intelligentRanking.ranked,
    portfolio: intelligentRanking.portfolio,
    falsificationPlan: buildFalsificationPlan(causal, intelligentRanking),
    securitySignals: securityFindings,
    selectedBy: selectedRepairStrategy ? 'TWIN_OR_EXTERNAL_SELECTION' : intelligentSelectedId ? 'V12_CAUSAL_PORTFOLIO' : 'DETERMINISTIC_ROTATION',
    exactShaRequired: true,
    mutationAuthority: 'REPAIR_ENGINE_ONLY',
    greenAuthority: 'CANONICAL_CI_ONLY',
    trainingAuthority: 'TRAINING_ONLY',
  },
  steering: steeringDirective,
  trainingMode: training?.decision?.mode ?? 'MISSING',
  trainingDecision,
  nextEvidence,
  decisionTrace,
  stateActionRecommendation,
  behavioralRecommendation,
  cycle: nextAttempt,
  twin: {
    present: Boolean(twinProposal || twinA || twinB || twinSelection),
    preferredStrategy: twinPreferredStrategy || null,
    executorStrategy: strategyId,
    divergent: Boolean(twinPreferredStrategy) && strategyId !== twinPreferredStrategy,
    disposition: twinSelection?.selection?.disposition ?? twinProposal?.challenge?.disposition ?? (twinA || twinB ? 'TWO_TWINS' : 'NO_TWIN'),
    selector: {
      selected: twinSelection?.selection?.selected ?? null,
      selectedStrategy: twinSelection?.selection?.selectedStrategy ?? null,
      ranked: twinSelection?.selection?.ranked ?? []
    }
  },
  protocol: 'SUPERVISING-REPAIR-TEACHING-v3-V13-TRAINED-BEHAVIOR',
}, null, 2)}\n`);
fs.writeFileSync('/tmp/flixo-intractable-state', 'false\n');
console.log(JSON.stringify({ fingerprint, attempt: nextAttempt, priorRepairArtifacts: persistedAttempts, strategyId, teachingEscalation, sameStrategyRepeated, teachingPacket, intractable: false, policy: 'EVERY_ACTIONABLE_RED_REQUIRES_NEW_EVIDENCE_OR_STRATEGY' }));
