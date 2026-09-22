#!/usr/bin/env node
export const READ_ONLY_POWER_PROFILE = Object.freeze({
  protocol: 'FLIXO-READ-ONLY-POWER-PROFILE-v1',
  profile: '5X',
  multiplier: 5,
  authority: 'READ_ONLY',
  mutationAuthority: false,
  exactShaRequired: true,
  dimensions: Object.freeze({
    runtimeEvidence: 5,
    sourceSurface: 5,
    historicalDepth: 5,
    adversarialChallenge: 5,
    knowledgeSynthesis: 5,
  }),
  budgets: Object.freeze({
    investigatorRunLimit: 400,
    investigatorMaxLogs: 175,
    vaultQueryTerms: 240,
    vaultAdviceMatches: 160,
    programmerTwinTrackedFiles: 6000,
    programmerTwinDefinitions: 600,
    programmerTwinCallersPerSymbol: 250,
    programmerTwinCalleesPerFunction: 250,
    programmerTwinEvidencePerSearch: 300,
    salientSignals: 150,
    recurringPatterns: 100,
    hypotheses: 45,
  }),
  layers: Object.freeze([
    'RUNTIME_EVIDENCE_FANOUT',
    'SOURCE_GRAPH_EXPANSION',
    'HISTORICAL_DEPTH_EXPANSION',
    'ADVERSARIAL_FALSIFICATION_EXPANSION',
    'KNOWLEDGE_SYNTHESIS_EXPANSION',
  ]),
  safety: Object.freeze([
    'NO_SOURCE_MUTATION',
    'NO_GIT_REF_MUTATION',
    'NO_CI_CONTROL_MUTATION',
    'NO_REPAIR_AUTHORITY',
    'NO_CERTIFICATION_AUTHORITY',
    'EXACT_SHA_BOUND',
  ]),
  execution: Object.freeze({
    protocol: 'FLIXO-FIVE-X-EXECUTION-LAYER-v1',
    status: 'ENFORCED_EXTENSION_OF_CANONICAL_POWER_PROFILE',
    layers: Object.freeze([
      'PROMPT_UNDERSTANDING_5X',
      'CONSTRAINT_REASONING_5X',
      'RCA_HYPOTHESIS_5X',
      'ADVERSARIAL_VERIFICATION_5X',
      'LEARNING_CONTINUITY_5X',
    ]),
    layerCount: 5,
    requiredEvidenceClasses: Object.freeze([
      'IDENTITY',
      'CONSTRAINTS',
      'CAUSALITY',
      'FALSIFICATION',
      'REGRESSION',
    ]),
    requiredEvidenceClassCount: 5,
    minimumHypotheses: 3,
    maximumHypotheses: 5,
    minimumCounterexampleChecks: 5,
    minimumRegressionDepth: 3,
    minimumIndependentEvidenceSources: 5,
    minimumLearningOutputs: 5,
    dispatchRequirements: Object.freeze([
      'CURRENT_EXACT_EXECUTION_SHA',
      'EXECUTION_BRANCH',
      'PRE_EXECUTION_25_PASS',
      'ADVERSARIAL_FALSIFICATION',
      'NO_SCOPE_CONFLICT',
      'CURRENT_SHA_RECHECK_BEFORE_DISPATCH',
    ]),
  }),
});


export function validateFiveXExecutionLayer(execution = READ_ONLY_POWER_PROFILE.execution) {
  const failures = [];
  if (execution?.protocol !== 'FLIXO-FIVE-X-EXECUTION-LAYER-v1') failures.push('FIVE_X_PROTOCOL_INVALID');
  if (execution?.status !== 'ENFORCED_EXTENSION_OF_CANONICAL_POWER_PROFILE') failures.push('FIVE_X_STATUS_INVALID');
  if (!Array.isArray(execution?.layers) || execution.layers.length !== 5) failures.push('FIVE_X_LAYERS_INVALID');
  if (execution?.layerCount !== 5) failures.push('FIVE_X_LAYER_COUNT_INVALID');
  if (!Array.isArray(execution?.requiredEvidenceClasses) || execution.requiredEvidenceClasses.length !== 5) failures.push('FIVE_X_EVIDENCE_CLASSES_INVALID');
  if (execution?.requiredEvidenceClassCount !== 5) failures.push('FIVE_X_EVIDENCE_CLASS_COUNT_INVALID');
  if (Number(execution?.minimumHypotheses) < 3 || Number(execution?.maximumHypotheses) < Number(execution?.minimumHypotheses)) failures.push('FIVE_X_HYPOTHESIS_RANGE_INVALID');
  if (Number(execution?.minimumCounterexampleChecks) < 5) failures.push('FIVE_X_COUNTEREXAMPLE_DEPTH_INVALID');
  if (Number(execution?.minimumRegressionDepth) < 3) failures.push('FIVE_X_REGRESSION_DEPTH_INVALID');
  if (Number(execution?.minimumIndependentEvidenceSources) < 5) failures.push('FIVE_X_EVIDENCE_DIVERSITY_INVALID');
  if (Number(execution?.minimumLearningOutputs) < 5) failures.push('FIVE_X_LEARNING_OUTPUT_INVALID');
  if (!Array.isArray(execution?.dispatchRequirements) || execution.dispatchRequirements.length < 6) failures.push('FIVE_X_DISPATCH_REQUIREMENTS_INVALID');
  return Object.freeze({ ok: failures.length === 0, failures });
}

export function buildFiveXExecutionEnvelope({
  exactSha,
  branch,
  selectedTaskId = null,
  hypothesisCount = 0,
  counterexampleChecks = 0,
  regressionDepth = 0,
  independentEvidenceSources = 0,
  learningOutputs = 0,
  proofClasses = [],
  preExecution25 = null,
  adversarialReview = null,
  scopeConflict = false,
} = {}) {
  const execution = READ_ONLY_POWER_PROFILE.execution;
  const validation = validateFiveXExecutionLayer(execution);
  const shaValid = /^[a-f0-9]{40}$/iu.test(String(exactSha ?? ''));
  const proofSet = new Set((Array.isArray(proofClasses) ? proofClasses : []).map(String));
  const proofComplete = execution.requiredEvidenceClasses.every((item) => proofSet.has(item));
  const adversarialClean =
    adversarialReview?.status === 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' &&
    adversarialReview?.counterexampleFound !== true;
  const checks = Object.freeze({
    profile: validation.ok,
    exactSha: shaValid,
    executionBranch: branch === 'execution',
    taskBound: Boolean(selectedTaskId),
    hypotheses: Number(hypothesisCount) >= execution.minimumHypotheses && Number(hypothesisCount) <= execution.maximumHypotheses,
    counterexampleSearch: Number(counterexampleChecks) >= execution.minimumCounterexampleChecks,
    regressionDepth: Number(regressionDepth) >= execution.minimumRegressionDepth,
    evidenceDiversity: Number(independentEvidenceSources) >= execution.minimumIndependentEvidenceSources,
    learningOutputs: Number(learningOutputs) >= execution.minimumLearningOutputs,
    proofClasses: proofComplete,
    preExecution25: preExecution25?.status === 'PASS' && Number(preExecution25?.operationCount) >= 25,
    adversarial: adversarialClean,
    scopeConflict: scopeConflict === false,
  });
  const blockers = Object.entries(checks).filter(([,ok]) => !ok).map(([key]) => 'FIVE_X_' + key.toUpperCase() + '_BLOCKED');
  return Object.freeze({
    protocol: execution.protocol,
    profile: READ_ONLY_POWER_PROFILE.profile,
    multiplier: READ_ONLY_POWER_PROFILE.multiplier,
    exactSha: String(exactSha ?? ''),
    branch: String(branch ?? ''),
    status: validation.ok && blockers.length === 0 ? 'READY_FOR_AUTHORIZED_EXECUTION' : 'BLOCKED',
    checks,
    blockers,
    minimums: {
      hypotheses: [execution.minimumHypotheses, execution.maximumHypotheses],
      counterexampleChecks: execution.minimumCounterexampleChecks,
      regressionDepth: execution.minimumRegressionDepth,
      independentEvidenceSources: execution.minimumIndependentEvidenceSources,
      learningOutputs: execution.minimumLearningOutputs,
    },
    authority: READ_ONLY_POWER_PROFILE.authority,
    mutationAuthority: false,
    certificationAuthority: false,
  });
}


export function buildFiveXRepairCycleState({
  phase = 'PRE_MUTATION',
  chainId = null,
  taskId = null,
  failureFingerprint = null,
  attempt = 1,
  targetSha = null,
  currentSha = null,
  failedSha = null,
  candidateSha = null,
  strategyId = null,
  previousCycle = null,
  outcome = null,
  verification = null,
  adversarialStatus = null,
  counterexampleFound = null,
  regressionOk = null,
  regressionDepth = 0,
  learningOutputs = 0,
  canonicalGreen = false,
} = {}) {
  const shaOk = (value) => /^[a-f0-9]{40}$/iu.test(String(value ?? ''));
  const fpOk = (value) => /^[a-f0-9]{64}$/iu.test(String(value ?? ''));
  const normalizedAttempt = Number(attempt);
  const previousStrategy = String(previousCycle?.strategyId ?? '').trim() || null;
  const currentStrategy = String(strategyId ?? '').trim() || null;
  const sameStrategy = Boolean(previousStrategy && currentStrategy && previousStrategy === currentStrategy);
  const exactSha = shaOk(targetSha) && shaOk(currentSha) && targetSha === currentSha;
  const failedShaMatchesTarget = !failedSha || !shaOk(failedSha) || failedSha === targetSha;
  const candidateBound = !candidateSha || shaOk(candidateSha);
  const identityValid =
    shaOk(targetSha) &&
    fpOk(failureFingerprint) &&
    String(chainId ?? '').trim().length > 0 &&
    String(taskId ?? '').trim().length > 0 &&
    Number.isInteger(normalizedAttempt) &&
    normalizedAttempt >= 1;
  const staleEvidence = !exactSha || !failedShaMatchesTarget || !candidateBound;
  const invalidatedPriorEvidence = Boolean(previousCycle?.targetSha && previousCycle.targetSha !== targetSha);
  const learningReady = Number(learningOutputs) >= READ_ONLY_POWER_PROFILE.execution.minimumLearningOutputs;
  const adversarialClean =
    adversarialStatus == null ||
    (adversarialStatus === 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' && counterexampleFound === false);
  const regressionReady =
    regressionOk == null ||
    (regressionOk === true && Number(regressionDepth) >= READ_ONLY_POWER_PROFILE.execution.minimumRegressionDepth);
  const repeatBlocked = sameStrategy && phase === 'PRE_MUTATION' && String(outcome ?? '').trim() !== 'success';
  const strategyChangeRequired = sameStrategy && Number(previousCycle?.attempt ?? 0) < normalizedAttempt;
  let state = 'READY_TO_CONTINUE';
  let nextAction = 'RUN_REQUIRED_VERIFICATION';
  if (!identityValid) {
    state = 'BLOCKED_IDENTITY';
    nextAction = 'REBUILD_CYCLE_WITH_EXACT_IDENTITY';
  } else if (staleEvidence || invalidatedPriorEvidence) {
    state = 'STALE_EVIDENCE';
    nextAction = 'INVALIDATE_PRIOR_EVIDENCE_AND_REQUALIFY_CURRENT_SHA';
  } else if (!adversarialClean) {
    state = 'COUNTEREXAMPLE_BLOCKED';
    nextAction = 'CAPTURE_COUNTEREXAMPLE_AND_CHANGE_STRATEGY';
  } else if (!regressionReady) {
    state = 'REGRESSION_INCOMPLETE';
    nextAction = 'RUN_REQUIRED_REGRESSION_DEPTH';
  } else if (!learningReady) {
    state = 'LEARNING_INCOMPLETE';
    nextAction = 'PERSIST_REQUIRED_LEARNING_OUTPUTS';
  } else if (repeatBlocked || strategyChangeRequired) {
    state = 'STRATEGY_REPEAT_BLOCKED';
    nextAction = 'SELECT_A_NEW_STRATEGY_USING_FRESH_EVIDENCE';
  } else if (canonicalGreen === true) {
    state = 'CLOSED_BY_CANONICAL_GREEN';
    nextAction = 'NO_FURTHER_REPAIR_CYCLE';
  } else if (
    outcome === 'success' ||
    outcome === 'verified-repair' ||
    outcome === 'verified-historical-revert' ||
    verification === 'exact-sha-proof'
  ) {
    state = 'VERIFICATION_PENDING_CANONICAL_GREEN';
    nextAction = 'WAIT_FOR_CANONICAL_GREEN_AND_CERTIFICATION_ON_NEW_SHA';
  }
  const statusForMutation = new Set([
    'READY_TO_CONTINUE',
    'VERIFICATION_PENDING_CANONICAL_GREEN',
  ]).has(state);
  return Object.freeze({
    protocol: 'FLIXO-FIVE-X-REPAIR-CYCLE-v1',
    phase: String(phase),
    chainId: String(chainId ?? ''),
    taskId: String(taskId ?? ''),
    failureFingerprint: String(failureFingerprint ?? ''),
    attempt: normalizedAttempt,
    targetSha: String(targetSha ?? ''),
    currentSha: String(currentSha ?? ''),
    failedSha: failedSha == null ? null : String(failedSha),
    candidateSha: candidateSha == null ? null : String(candidateSha),
    strategyId: currentStrategy,
    previousStrategy,
    sameStrategy,
    exactSha,
    invalidatedPriorEvidence,
    staleEvidence,
    strategyChangeRequired,
    mutationReady: statusForMutation && !staleEvidence && !invalidatedPriorEvidence && !repeatBlocked,
    adversarialStatus,
    counterexampleFound,
    regressionOk,
    regressionDepth: Number(regressionDepth),
    learningOutputs: Number(learningOutputs),
    learningReady,
    outcome: outcome == null ? null : String(outcome),
    verification: verification == null ? null : String(verification),
    canonicalGreen: canonicalGreen === true,
    state,
    closureAuthority: canonicalGreen === true ? 'CANONICAL_GREEN_AND_CERTIFICATION' : 'NONE',
    nextAction,
  });
}

export function validateReadOnlyPowerProfile(profile = READ_ONLY_POWER_PROFILE) {
  const failures = [];
  if (profile?.profile !== '5X') failures.push('PROFILE_NOT_5X');
  if (profile?.multiplier !== 5) failures.push('MULTIPLIER_NOT_5');
  if (profile?.authority !== 'READ_ONLY') failures.push('AUTHORITY_NOT_READ_ONLY');
  if (profile?.mutationAuthority !== false) failures.push('MUTATION_AUTHORITY_LEAK');
  if (profile?.exactShaRequired !== true) failures.push('EXACT_SHA_REQUIREMENT_MISSING');
  if (!Array.isArray(profile?.layers) || profile.layers.length !== 5) failures.push('FIVE_LAYERS_REQUIRED');
  for (const [key, value] of Object.entries(profile?.dimensions ?? {})) {
    if (value !== 5) failures.push('DIMENSION_NOT_5=' + key);
  }
  for (const rule of profile?.safety ?? []) {
    if (!String(rule).startsWith('NO_') && rule !== 'EXACT_SHA_BOUND') failures.push('UNRECOGNIZED_SAFETY_RULE=' + rule);
  }
  return Object.freeze({ ok: failures.length === 0, failures });
}
