const SHA_RE = /^[a-f0-9]{40}$/u;

export const TEN_X_REPAIR_METHOD = Object.freeze({
  version: 'TEN-X-PROOF-CARRYING-REPAIR-v1',
  amplificationFactor: 10,
  authority: 'PRE_MUTATION_PROOF_GATE_ONLY',
  passes: Object.freeze([
    Object.freeze({ id: 'X1_EXACT_SHA', class: 'IDENTITY' }),
    Object.freeze({ id: 'X2_CAUSAL_PROOF', class: 'CAUSALITY' }),
    Object.freeze({ id: 'X3_ADVERSARIAL_CHALLENGE', class: 'FALSIFICATION' }),
    Object.freeze({ id: 'X4_LEARNING_MEMORY', class: 'LEARNING' }),
    Object.freeze({ id: 'X5_VERIFICATION_PLAN', class: 'VERIFICATION' }),
    Object.freeze({ id: 'X6_PATCH_SIMULATION', class: 'PRE_MUTATION_SIMULATION' }),
    Object.freeze({ id: 'X7_COUNTEREXAMPLE_HUNT', class: 'ADVERSARIAL_FALSIFICATION' }),
    Object.freeze({ id: 'X8_PATCH_CORRECTNESS_PROOF', class: 'PATCH_CORRECTNESS' }),
    Object.freeze({ id: 'X9_INDEPENDENT_REPAIR_JUDGE', class: 'INDEPENDENT_JUDGMENT' }),
    Object.freeze({ id: 'X10_ADAPTIVE_REPAIR_PORTFOLIO', class: 'ADAPTIVE_SELECTION' }),
  ]),
});

function pass(id, passed, reason) {
  return Object.freeze({ id, passed: Boolean(passed), reason: String(reason || '') });
}

export function buildAdaptiveFailureMemory({
  attempt = 1,
  priorStrategies = [],
  selectedStrategy = null,
  allStrategiesExhausted = false,
  teachingEscalation = false,
  causalRootCause = 'unknown',
}) {
  const numericAttempt = Math.max(1, Number(attempt) || 1);
  const previousStrategy = String(priorStrategies.at(-1) || '').trim() || null;
  const selected = String(selectedStrategy || '').trim() || null;
  const priorDistinct = new Set((priorStrategies || []).map(String).filter(Boolean));
  const repeatOfPrevious = Boolean(previousStrategy && selected && previousStrategy === selected);
  const requiresStrategyChange = priorDistinct.size > 0;
  const strategyChangeConfirmed = requiresStrategyChange && Boolean(selected && selected !== previousStrategy);
  const supervisorEscalationRequired = Boolean(allStrategiesExhausted || teachingEscalation || numericAttempt >= 10);

  let phase = 'FIRST_OBSERVATION';
  if (numericAttempt >= 10 || supervisorEscalationRequired) phase = 'HIGH_RECURRENCE_REQUIRES_SUPERVISORY_ESCALATION';
  else if (numericAttempt >= 4 || priorDistinct.size >= 3) phase = 'MULTI_ATTEMPT_REQUIRES_STRATEGY_CHANGE';
  else if (priorDistinct.size > 0) phase = 'REPEAT_REQUIRES_FALSIFICATION';

  return Object.freeze({
    protocol: 'ADAPTIVE-FAILURE-MEMORY-v1',
    attempt: numericAttempt,
    phase,
    rootCause: String(causalRootCause || 'unknown'),
    priorStrategyCount: priorStrategies.length,
    distinctStrategyCount: priorDistinct.size,
    previousStrategy,
    selectedStrategy: selected,
    sameStrategyRepeated: repeatOfPrevious,
    requiresStrategyChange,
    strategyChangeConfirmed,
    supervisorEscalationRequired,
    newEvidenceRequired: priorDistinct.size > 0 || supervisorEscalationRequired,
    admissibleRoute: supervisorEscalationRequired && allStrategiesExhausted
      ? 'SUPERVISORY_ESCALATION_OR_NEW_EVIDENCE'
      : 'EVIDENCE_BACKED_STRATEGY_ROTATION',
  });
}

export function buildTenXRepairProfile({
  targetSha,
  strategy = {},
  rootProof = {},
  rcaManifest = {},
  masterPacket = {},
}) {
  const target = String(targetSha || '');
  const five = strategy.fiveXRepair || {};
  const strategyTarget = strategy.targetSha || five.targetSha || strategy.steering?.targetSha || strategy.decisionTrace?.targetSha || '';
  const targetBound =
    SHA_RE.test(target)
    && target === String(strategyTarget)
    && target === String(rootProof.targetSha || '')
    && target === String(masterPacket.target?.targetSha || '')
    && target === String(masterPacket.target?.currentSha || '');

  const rootClaims = rootProof.proofClaims || {};
  const proposedFix = rcaManifest.proposed_fix || {};
  const deterministicProof = rcaManifest.deterministic_proof || {};
  const portfolio = [
    ...(Array.isArray(strategy.intelligence?.portfolio) ? strategy.intelligence.portfolio : []),
    ...(Array.isArray(strategy.intelligence?.rankedStrategies) ? strategy.intelligence.rankedStrategies : []),
  ].filter((item, index, all) => item && (item.id || item.strategyId) && all.findIndex((other) => (other?.id || other?.strategyId) === (item.id || item.strategyId)) === index);
  const selectedStrategy = String(strategy.strategyId || '').trim();

  const adaptiveMemory = strategy.adaptiveFailureMemory || {};
  const strategyChangeSafe =
    adaptiveMemory.requiresStrategyChange !== true
    || adaptiveMemory.strategyChangeConfirmed === true
    || adaptiveMemory.supervisorEscalationRequired === true;

  const passes = [
    pass('X1_EXACT_SHA', targetBound, targetBound ? 'all pre-mutation evidence targets match execution SHA' : 'target SHA is missing or evidence is stale'),
    pass('X2_CAUSAL_PROOF',
      five.completedPasses >= 2 || (rootProof.status === 'PROVEN' && rootClaims.MECHANISM_EXPLAINED === true),
      'causal mechanism is explicitly linked'),
    pass('X3_ADVERSARIAL_CHALLENGE',
      (five.passes || []).some((item) => item.id === 'X3_ADVERSARIAL_CHALLENGE' && item.passed === true)
        && rootClaims.ALTERNATIVES_CHALLENGED === true,
      'alternative hypotheses are challenged'),
    pass('X4_LEARNING_MEMORY',
      strategy.trainingDecision?.eligible === true
        || strategy.trainingDecision?.mode === 'TRAINED_ROUTING'
        || Boolean(strategy.adaptiveFailureMemory?.protocol)
        || Number(strategy.intelligence?.rankedStrategies?.length || 0) > 0,
      'learning context is advisory and attached to the decision trace'),
    pass('X5_VERIFICATION_PLAN',
      five.readyForBoundedMutation === true
        && Boolean(strategy.failureFingerprint || strategy.stableCaseFingerprint),
      'five-pass verification contract is complete'),
    pass('X6_PATCH_SIMULATION',
      deterministicProof.status === 'PRE_MUTATION_BOUNDED'
        && proposedFix.isolation_level === 'SURGICAL_PATCH'
        && Number(proposedFix.scope?.max_source_files ?? 0) === 1,
      'repair proposal is constrained to one surgical source file'),
    pass('X7_COUNTEREXAMPLE_HUNT',
      Array.isArray(masterPacket.intelligence?.falsification)
        && masterPacket.intelligence.falsification.length >= 10
        && masterPacket.intelligence.falsification.every((item) => item?.pass !== false),
      'master falsification dossier contains no failed checks'),
    pass('X8_PATCH_CORRECTNESS_PROOF',
      rootProof.status === 'PROVEN'
        && rootProof.sourceMutationAllowed === false
        && rootClaims.ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL === true
        && rootClaims.LOCATION_LINKED_TO_CAUSE === true
        && rootClaims.MECHANISM_EXPLAINED === true
        && rootClaims.ALTERNATIVES_CHALLENGED === true,
      'proposed mutation is causally and semantically bound'),
    pass('X9_INDEPENDENT_REPAIR_JUDGE',
      masterPacket.protocol === 'FLIXO-MASTER-REPAIR-ORCHESTRATOR-v1'
        && masterPacket.authority === 'READ_ONLY_MASTER_REPAIR_GATE'
        && masterPacket.mutationAuthority === false
        && masterPacket.certificationAuthority === false
        && masterPacket.decision?.status === 'MASTER_REPAIR_READY'
        && Number(masterPacket.decision?.confidence ?? 0) >= 0.8,
      'independent read-only Master Repair Gate is ready'),
    pass('X10_ADAPTIVE_REPAIR_PORTFOLIO',
      portfolio.length >= 2
        && Boolean(selectedStrategy)
        && portfolio.some((item) => String(item.id || item.strategyId) === selectedStrategy)
        && strategyChangeSafe,
      'multiple strategies are available and recurrence is not blind'),
  ];

  const completedPasses = passes.filter((item) => item.passed).length;
  const readyForMutation = completedPasses === 10;
  return Object.freeze({
    protocol: 'FLIXO-TEN-X-REPAIR-GATE-v1',
    method: TEN_X_REPAIR_METHOD.version,
    amplificationFactor: TEN_X_REPAIR_METHOD.amplificationFactor,
    authority: TEN_X_REPAIR_METHOD.authority,
    targetSha: target || null,
    selectedStrategy: selectedStrategy || null,
    passes: Object.freeze(passes.map((item) => Object.freeze(item))),
    completedPasses,
    requiredPasses: 10,
    readyForMutation,
    readyForBoundedMutation: readyForMutation,
    route: readyForMutation ? 'BOUNDED_REPAIR' : 'ESCALATE_OR_COLLECT_MORE_EVIDENCE',
  });
}
