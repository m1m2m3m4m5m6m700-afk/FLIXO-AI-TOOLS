import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import { fingerprintFailure, normalizeFailure, extractFeatures, loadMemory, findCase, findSimilarCases, rankLessons, scorePlaybook, deriveReusableKnowledge, writeMemory, recordOutcome } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { runAstRepair } from './auto-repair/ast-repair.mjs';
import { reproduce, resolveTargetedTests } from './auto-repair/reproduction.mjs';
import { buildVerificationPlan, checkVerificationContamination, reproduceStable, verifyTargetIdentity } from './auto-repair/verification.mjs';
import { runRegression } from './auto-repair/regression.mjs';
import { summarizeDiff, writeEvidence, mutationAttribution } from './auto-repair/evidence.mjs';
import { snapshot, rollback } from './auto-repair/rollback.mjs';
import { findHistoricalRepairCandidate, applyHistoricalRepair, historicalRollbackRecord } from './auto-repair/historical-rollback.mjs';
import { validateRepairProof, preventionRuleFor, escalationReason } from './auto-repair-proof.mjs';
import { critiqueRepair } from './auto-repair/self-critic.mjs';
import { buildCausalProof } from './auto-repair/causal-proof.mjs';
import { buildRepairKnowledgeGraph } from './auto-repair/knowledge-graph.mjs';
import { assertAgentAdmission, createRepairSession, captureFailure, authorizeMutation, completeRepairSession, validateActionVaultVerifierProof, validateErrorOnlyMutation, validateMinimalRepairScope, validateTargetedRegressionSelection } from './repair-protocol.mjs';
import { loadAttemptLedger, isRepairRejected, rejectionReasons } from './repair-attempt-ledger.mjs';
import { buildErrorOnlyRepairModel } from './auto-repair/error-only-programmer.mjs';
import { simulateAstRepair } from './action-repair-sandbox.mjs';
import { evaluateMutationGate } from './action-vault-mutation-gate.mjs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const targetDir = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const fingerprint = fingerprintFailure(log);
const repairChainId = String(process.env.FLIXO_REPAIR_CHAIN_ID ?? process.env.TARGET_RUN_ID ?? '').trim();
const normalizedFailure = normalizeFailure(log);
const features = extractFeatures(log);
const evidencePath = process.env.FLIXO_REPAIR_EVIDENCE_PATH ?? '/tmp/flixo-repair-evidence.json';
const diagnosisPath = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';
const git = (args, options = {}) => execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8', ...options });
const targetSha = git(['rev-parse', 'HEAD']).trim();
const protocolBranch = git(['branch', '--show-current']);
if (protocolBranch !== 'execution') throw new Error('REPAIR_PROTOCOL_MUTATION_BRANCH_BLOCKED');
const repairSessionId = process.env.FLIXO_REPAIR_SESSION_ID ?? process.env.FLIXO_REPAIR_CHAIN_ID ?? `repair-${process.env.GITHUB_RUN_ID ?? 'local'}-${targetSha.slice(0, 12)}`;
const repairActor = process.env.FLIXO_REPAIR_ACTOR ?? 'repairAgent';
const fallbackProofPath = process.env.FLIXO_ASSISTANT_FALLBACK_PROOF_PATH ?? '';
const fallbackProof = fallbackProofPath && fs.existsSync(fallbackProofPath) ? JSON.parse(fs.readFileSync(fallbackProofPath, 'utf8')) : null;
if (repairActor === 'assistantRepairAgent' && !fallbackProof?.fallbackEligible) throw new Error('ASSISTANT_FALLBACK_PROOF_REQUIRED');
const assistantApprovalPath = process.env.FLIXO_ASSISTANT_APPROVAL_PATH ?? '';
const assistantApproval = assistantApprovalPath && fs.existsSync(assistantApprovalPath)
  ? JSON.parse(fs.readFileSync(assistantApprovalPath, 'utf8'))
  : null;
const actionVaultVerifierProofPath = process.env.FLIXO_ACTION_VAULT_VERIFIER_PROOF_PATH ?? '';
const cognitiveAwarenessPath = process.env.FLIXO_SYSTEM_COGNITIVE_AWARENESS_PATH ?? '';
const programmerTwinParityPath = process.env.FLIXO_ACTION_REPAIR_TWIN_PARITY_PATH ?? '';
const programmerTwinReportPath = process.env.FLIXO_ACTION_REPAIR_PROGRAMMER_TWIN_PATH ?? '';
const preMutationProofPath = process.env.FLIXO_ACTION_VAULT_PRE_MUTATION_PROOF_PATH ?? '';
const fileSelectionPath = process.env.FLIXO_FILE_SELECTION_PATH ?? '';
const actionVaultVerifierProof = actionVaultVerifierProofPath && fs.existsSync(actionVaultVerifierProofPath)
  ? JSON.parse(fs.readFileSync(actionVaultVerifierProofPath, 'utf8'))
  : null;
const cognitiveAwareness = cognitiveAwarenessPath && fs.existsSync(cognitiveAwarenessPath)
  ? JSON.parse(fs.readFileSync(cognitiveAwarenessPath, 'utf8'))
  : null;
const programmerTwinParity = programmerTwinParityPath && fs.existsSync(programmerTwinParityPath)
  ? JSON.parse(fs.readFileSync(programmerTwinParityPath, 'utf8'))
  : null;
const programmerTwinReport = programmerTwinReportPath && fs.existsSync(programmerTwinReportPath)
  ? JSON.parse(fs.readFileSync(programmerTwinReportPath, 'utf8'))
  : null;
const preMutationProof = preMutationProofPath && fs.existsSync(preMutationProofPath)
  ? JSON.parse(fs.readFileSync(preMutationProofPath, 'utf8'))
  : null;
const fileSelection = fileSelectionPath && fs.existsSync(fileSelectionPath)
  ? JSON.parse(fs.readFileSync(fileSelectionPath, 'utf8'))
  : null;
if (repairActor === 'actionRepairBot') {
  if (cognitiveAwareness?.protocol !== 'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1' || cognitiveAwareness?.targetSha !== targetSha || cognitiveAwareness?.awarenessCompleteness?.complete !== true) throw new Error('ACTION_REPAIR_COGNITIVE_AWARENESS_REQUIRED');
  if (programmerTwinParity?.status !== 'EXACT_INTELLIGENCE_PARITY' || programmerTwinParity?.intelligenceParity !== 'EXACT' || programmerTwinParity?.authorityParity !== 'SEPARATED_BY_DESIGN' || programmerTwinParity?.targetSha !== targetSha) throw new Error('ACTION_REPAIR_PROGRAMMER_TWIN_PARITY_REQUIRED');
  validateActionVaultVerifierProof({ proof: actionVaultVerifierProof, targetSHA: targetSha, failureFingerprint: fingerprint });
}
let repairProtocolSession = createRepairSession({ repairSessionId, actor: repairActor, failureFingerprint: fingerprint, targetSHA: targetSha, beforeState: { worktree: 'clean', targetSha }, attempt: Number(process.env.FLIXO_REPAIR_ATTEMPT ?? 1), fallback: repairActor === 'assistantRepairAgent' ? { ...fallbackProof, actor: 'assistantRepairAgent', targetSha } : null, assistantApproval, actionVaultVerifierProof });
if (repairActor === 'actionRepairBot') {
  const taskId = process.env.FLIXO_AGENT_TASK ?? process.env.FLIXO_TASK_ID ?? process.env.TARGET_RUN_ID ?? repairSessionId;
  repairProtocolSession = Object.freeze({
    ...repairProtocolSession,
    actionVaultMission: {
      role: 'ACTION-REPAIR',
      triadId: 'ACTION-THREE-BOT-COLLABORATION',
      messageId: `ACTION-VAULT:${taskId}:${fingerprint}`,
      taskId,
      failureFingerprint: fingerprint,
      entrySha: targetSha,
      targetSha,
      ownerAgent: 'actionRepairBot',
      verifierAgent: 'actionRepairVerifier',
      historianAgent: 'actionHistorian',
      programmerTwinParity: {
        intelligenceParity: programmerTwinParity.intelligenceParity,
        authorityParity: programmerTwinParity.authorityParity,
        targetSha: programmerTwinParity.targetSha
      },
      cognitiveAwareness: {
        protocol: cognitiveAwareness.protocol,
        targetSha: cognitiveAwareness.targetSha,
        complete: cognitiveAwareness.awarenessCompleteness.complete
      },
      proofObligations: ['PRIMARY_CORRECTNESS_PROOF','ADVERSARIAL_FALSIFICATION','TARGETED_REGRESSION','CANONICAL_GREEN'],
      stopConditions: ['VALID_COUNTEREXAMPLE','SHA_DRIFT','COGNITIVE_AWARENESS_MISSING','PARITY_MISMATCH','CANONICAL_GREEN_FAILURE'],
      noBlindRetry: true
    }
  });
}
repairProtocolSession = captureFailure(repairProtocolSession, { runId: process.env.GITHUB_RUN_ID ?? null, failureFingerprint: fingerprint, logPath });
const prepareTargetedVerification = (currentLog, currentFeatures) => {
  const selection = resolveTargetedTests(currentLog, currentFeatures, { targetDir });
  const targetIdentity = verifyTargetIdentity(targetDir, selection);
  const verificationPlan = buildVerificationPlan(selection, targetIdentity);
  if (!selection.exact || !targetIdentity.ok) return {
    ok: false,
    selection,
    targetIdentity,
    verificationPlan,
    reason: 'verification-target-not-exact:' + targetIdentity.reason,
  };
  const reproductionStability = reproduceStable(targetDir, selection.commands, reproduce, { attempts: 3 });
  return {
    ok: reproductionStability.classification === 'REPRODUCIBLE_FAILURE',
    selection,
    targetIdentity,
    verificationPlan,
    reproductionStability,
    reason: reproductionStability.classification === 'REPRODUCIBLE_FAILURE' ? null : 'baseline-not-reproducible:' + reproductionStability.classification,
  };
};
const attemptLedger = loadAttemptLedger(process.env.FLIXO_REPAIR_ATTEMPT_LEDGER ?? '/tmp/flixo-repair-attempt-ledger.json', { chainId: repairChainId });
const stableCaseFingerprint = String(process.env.FLIXO_FAILURE_FINGERPRINT ?? '').trim() || attemptLedger.caseFingerprint || fingerprint;
attemptLedger.caseFingerprint = stableCaseFingerprint;
const memory = loadMemory();
const known = findCase(memory, fingerprint);
const similar = findSimilarCases(memory, { fingerprint, normalized: normalizedFailure, features });
const lessons = rankLessons(memory, { fingerprint });
const trustedLessons = lessons.filter((item) => !item.anti && item.confidence >= 0.75);
const blockedLessons = lessons.filter((item) => item.anti && item.confidence >= 0.5);
const revertedRuleIds = new Set(known?.revertedRules ?? []);
const diagnosis = fs.existsSync(diagnosisPath) ? JSON.parse(fs.readFileSync(diagnosisPath, 'utf8')) : null;
const historicalRollbackCandidate = findHistoricalRepairCandidate(targetDir, {
  fingerprint,
  currentSha: targetSha,
  memoryCase: known,
  historyLimit: Number(process.env.FLIXO_HISTORY_LIMIT ?? 30),
});

// Continuous RED invariant: learning may escalate and rotate strategy, but it may never
// terminate an actionable repair chain. Canonical GREEN is the only closure authority.
if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_ESCALATION_CONTINUE');
  console.log('AUTO_REPAIR_REASON=MAX_ATTEMPTS_IS_NOT_A_TERMINAL_STATE');
}
if (repairPolicy.requireCleanGitBeforeRepair && git(['status', '--porcelain']).trim()) throw new Error('AUTO_REPAIR_DIRTY_WORKTREE');

const historicalReasoningSupport = [
  ...memory.cases.map(({ rootCause, successes, attempts }) => ({ rootCause, confidence: attempts ? successes / attempts : 0 })),
  ...memory.lessons.map(({ rootCause, confidence }) => ({ rootCause, confidence })),
];
const reusableKnowledge = deriveReusableKnowledge(memory, { rootCause: diagnosis?.rootCause ?? 'unknown', features, fingerprint });
const plan = planRepair(log, { historical: historicalReasoningSupport, memory });
const specialist = selectSpecialist(plan.features);
let selected = plan.selected;
if (repairActor === 'assistantRepairAgent') {
  const approvedRule = fallbackProof?.approvedLearnedRule;
  const approvedCandidate = plan.candidates.find((candidate) => candidate.id === approvedRule && candidate.mutate && Number(candidate.confidence ?? 0) >= 90);
  if (!approvedCandidate) throw new Error('ASSISTANT_FALLBACK_LEARNED_RULE_NOT_REUSABLE_ON_CURRENT_SHA');
  selected = approvedCandidate;
}
const historicalRules = [
  ...(reusableKnowledge.generalizedRules ?? []).map((item) => item.rule).filter(Boolean),
];
const historicalCandidate = plan.candidates.find((candidate) => historicalRules.includes(candidate.id) && candidate.mutate && candidate.confidence >= 90 && !revertedRuleIds.has(candidate.id));
const blockedRuleIds = new Set(blockedLessons.map((item) => item.rule).filter(Boolean));
if (selected?.id && blockedRuleIds.has(selected.id) && !trustedLessons.some((item) => item.rule === selected.id && item.confidence >= 0.85)) selected = null;
if (selected?.id && revertedRuleIds.has(selected.id)) selected = null;
if (selected?.id !== 'prepared-source-change' && historicalCandidate && !blockedRuleIds.has(historicalCandidate.id) && !isRepairRejected(attemptLedger, { chainId: repairChainId, caseFingerprint: stableCaseFingerprint, ruleId: historicalCandidate.id, strategyId: process.env.FLIXO_REPAIR_STRATEGY_ID ?? null }) && (!selected || scorePlaybook(memory, specialist?.id ?? 'unknown', historicalCandidate.id) >= scorePlaybook(memory, specialist?.id ?? 'unknown', selected.id))) {
  selected = {
    ...historicalCandidate,
    file: selected?.file ?? plan.reasoning?.location?.file ?? null,
  };
}
const durableLedgerRejected = selected?.id ? isRepairRejected(attemptLedger, { chainId: repairChainId, caseFingerprint: stableCaseFingerprint, strategyId: process.env.FLIXO_REPAIR_STRATEGY_ID ?? null, ruleId: selected.id }) : false;
if (durableLedgerRejected) selected = null;

const evidence = {
  schemaVersion: 6,
  protocol: 'AUTONOMOUS-REPAIR-PROTOCOL-v4',
  repairProtocol: repairProtocolSession,
  actionVault: repairActor === 'actionRepairBot' ? { enabled: true, verifierProofPath: actionVaultVerifierProofPath, verifierProof: actionVaultVerifierProof, verifierAgent: 'actionRepairVerifier', historianAgent: 'actionHistorian' } : null,
  fingerprint,
  targetSha,
  features,
  diagnosis,
  specialist,
  candidates: plan.candidates,
  reasoning: plan.reasoning,
  inferenceFallback: plan.inferenceFallback ?? null,
  reusableKnowledge,
  selected: selected?.id ?? null,
  historicalRollbackCandidate: historicalRollbackCandidate ? historicalRollbackRecord(historicalRollbackCandidate) : null,
  trustedMemorySource: {
    mode: process.env.FLIXO_TRUSTED_REPAIR_MEMORY ? 'canonical-main-snapshot' : 'local-output-memory',
    sourceSha: process.env.FLIXO_TRUSTED_MEMORY_SHA ?? null,
  },
  learning: {
    memoryVersion: memory.version,
    exactCase: Boolean(known),
    similarCases: similar.map(({ case: item, score }) => ({ fingerprint: item.fingerprint, score, rules: item.rules ?? [] })),
    trustedLessons: trustedLessons.map(({ id, fingerprint: lessonFingerprint, rootCause, rule, confidence }) => ({ id, fingerprint: lessonFingerprint, rootCause, rule, confidence })),
    blockedLessons: blockedLessons.map(({ id, fingerprint: lessonFingerprint, rootCause, rule, confidence }) => ({ id, fingerprint: lessonFingerprint, rootCause, rule, confidence })),
    decision: selected?.id ? 'historical-learning-assisted' : 'no-trusted-learned-repair',
    durableNoRepeat: { enabled: true, chainId: repairChainId || null, caseFingerprint: stableCaseFingerprint, rejectedSelection: durableLedgerRejected, rejectedReasons: rejectionReasons(attemptLedger, { chainId: repairChainId, caseFingerprint: stableCaseFingerprint, strategyId: process.env.FLIXO_REPAIR_STRATEGY_ID ?? null, ruleId: plan.selected?.id ?? null }).slice(-20) },
  },
  outcome: 'diagnostic-only',
  changedPaths: [],
  capabilityVersion: 'V11-CAUSAL-SIMULATION-ADVERSARIAL-PROOF',
  updatedAt: new Date().toISOString(),
};

const reasoningDecision = diagnosis?.decision ?? null;
const diagnosisGate = {
  required: true,
  present: Boolean(diagnosis),
  quality: diagnosis?.diagnosisQuality ?? 'missing',
  confidence: diagnosis?.causalConfidence ?? 0,
  ambiguous: diagnosis?.ambiguity ?? true,
  directFailureSignal: diagnosis?.directFailureSignal ?? false,
  reasoningDecision,
  inferenceFallback: plan.inferenceFallback?.prediction ?? null,
  allowed: (
    Boolean(diagnosis) &&
    diagnosis.diagnosisQuality === 'strong' &&
    diagnosis.causalConfidence >= 0.75 &&
    !diagnosis.ambiguity &&
    diagnosis.directFailureSignal &&
    reasoningDecision === 'ALLOW_BOUNDED_MUTATION'
  ) || Boolean(plan.inferenceFallback?.prediction?.eligibleForBoundedMutation),
};
evidence.diagnosisGate = diagnosisGate;

if (historicalRollbackCandidate && diagnosisGate.allowed) {
  const before = snapshot(targetDir);
  const plannedChangedPaths = preMutationProof.sandboxSimulation?.changedFiles ?? [];
  const candidateDiff = preMutationProof.sandboxSimulation?.candidateDiff ?? '';
  const mutationScope = {
    changedPaths: plannedChangedPaths,
    selectedFiles: fileSelection?.selectedFiles?.map((item) => item.path).filter(Boolean) ?? [],
    testMutation: plannedChangedPaths.some((file) => /(^|\/)(?:tests?|__tests__)\//u.test(file)),
    controlPlaneMutation: plannedChangedPaths.some((file) => /^scripts\/ci\/|^\\.github\/workflows\//u.test(file)),
    mainMutation: false,
    gateWeakening: /continue-on-error|test\\.(?:skip|only)|describe\\.(?:skip|only)|eslint-disable|@ts-(?:ignore|nocheck)/iu.test(candidateDiff),
  };
  const mutationGate = evaluateMutationGate({
    targetSha,
    currentSha: git(['rev-parse', 'HEAD']).trim(),
    failureFingerprint: fingerprint,
    verifierProof: actionVaultVerifierProof,
    cognitiveAwareness,
    rootCauseProof: preMutationProof.rootCauseProof,
    fileSelection,
    programmerTwinParity,
    falsificationReport: programmerTwinReport,
    simulationProof: preMutationProof.sandboxSimulation,
    differentialProof: preMutationProof.differentialProof,
    patchCorrectness: preMutationProof.patchCorrectness,
    regressionCounterexamples: preMutationProof.regressionCounterexamples,
    mutationScope,
    branch: protocolBranch,
  });
  evidence.mutationGate = mutationGate;
  if (mutationGate.status !== 'PASS') {
    evidence.outcome = 'proposal-only';
    evidence.escalation = { required: true, reason: 'hard-mutation-gate-blocked', blockedReasons: mutationGate.failures };
    writeEvidence(evidencePath, evidence);
    recordOutcome(memory, {
      fingerprint,
      normalizedFailure,
      features,
      rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
      rule: selected.id,
      outcome: 'proposed',
      verification: 'hard-mutation-gate-blocked',
      provenance: { targetSha, mutationGate },
      preventionRule: 'No source mutation is admissible until every exact-SHA evidence, falsification, simulation, differential, patch, and regression obligation passes.',
    });
    writeMemory(memory);
    console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
    console.log('AUTO_REPAIR_REASON=hard-mutation-gate-blocked');
    process.exit(0);
  }
  if (repairActor === 'actionRepairBot') {
    evidence.outcome = 'proposal-only';
    evidence.escalation = { required: true, reason: 'historical-rollback-requires-action-vault-sandbox-proof' };
    writeEvidence(evidencePath, evidence);
    recordOutcome(memory, {
      fingerprint, normalizedFailure, features,
      rootCause: diagnosis?.rootCause ?? 'unknown',
      rule: historicalRollbackCandidate.rule ?? undefined,
      outcome: 'proposed',
      verification: 'action-vault-historical-rollback-sandbox-required',
      provenance: { targetSha, revertedCommit: historicalRollbackCandidate.commitSha },
      preventionRule: 'Action Vault never applies a historical rollback without an executable exact-SHA pre-mutation simulation.',
    });
    writeMemory(memory);
    console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
    console.log('AUTO_REPAIR_REASON=historical-rollback-requires-action-vault-sandbox-proof');
    process.exit(0);
  }
  repairProtocolSession = authorizeMutation(repairProtocolSession);
  assertAgentAdmission({ actor: repairActor, branch: protocolBranch, mutation: true, session: repairProtocolSession });
  const preparedVerification = prepareTargetedVerification(log, plan.features);
  evidence.reproductionSelection = preparedVerification.selection;
  evidence.targetIdentity = preparedVerification.targetIdentity;
  evidence.verificationPlan = preparedVerification.verificationPlan;
  evidence.reproductionCommands = evidence.reproductionSelection.commands;
  evidence.targetedRegression = validateTargetedRegressionSelection(evidence.reproductionSelection);
  evidence.reproductionStability = preparedVerification.reproductionStability ?? null;
  evidence.reproductionBefore = preparedVerification.reproductionStability?.firstRun ?? null;
  if (!preparedVerification.ok) {
    evidence.outcome = 'proposal-only';
    evidence.escalation = { required: true, reason: preparedVerification.reason };
    writeEvidence(evidencePath, evidence);
    recordOutcome(memory, {
      fingerprint,
      normalizedFailure,
      features,
      rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
      rule: selected?.id,
      outcome: 'proposed',
      verification: 'failure-directed-baseline-blocked',
      provenance: { targetSha, targetIdentity: evidence.targetIdentity, reproductionStability: evidence.reproductionStability },
      preventionRule: 'Require an exact, uniquely identified, stable failing target before source mutation.',
    });
    writeMemory(memory);
    console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
    console.log('AUTO_REPAIR_REASON=' + preparedVerification.reason);
    console.log('AUTO_REPAIR_FINGERPRINT=' + fingerprint);
    process.exit(0);
  }
  evidence.historicalRollback = historicalRollbackRecord(historicalRollbackCandidate);
  evidence.selected = historicalRollbackCandidate.rule ?? null;
  evidence.learning.decision = 'historical-rollback';
  try {
    evidence.repair = {
      ...(applyHistoricalRepair(targetDir, historicalRollbackCandidate)),
      kind: 'historical-revert',
    };
    const changed = git(['diff', '--binary']);
    const diffSummary = summarizeDiff(changed);
    evidence.diff = diffSummary;
    evidence.changedPaths = diffSummary.files;
  evidence.errorOnlyMutationPostDiff = validateErrorOnlyMutation({
    failureLocation: diagnosis?.location?.file ?? selected?.file ?? evidence.errorOnlyMutation.selectedFiles[0],
    selectedFile: selected?.file ?? evidence.errorOnlyMutation.selectedFiles[0],
    selectedFiles: evidence.errorOnlyMutation.selectedFiles,
    changedPaths: diffSummary.files,
  });
    evidence.errorOnlyMutation = validateErrorOnlyMutation({
      failureLocation: diagnosis?.location?.file,
      selectedFile: historicalRollbackCandidate?.file ?? diagnosis?.location?.file,
      changedPaths: diffSummary.files,
    });
    const attributionResultingSHA = git(['rev-parse', 'HEAD']).trim();
    evidence.mutationAttribution = mutationAttribution({
      agentIdentity: repairActor,
      taskId: process.env.FLIXO_AGENT_TASK ?? process.env.FLIXO_TASK_ID ?? null,
      baselineSHA: targetSha,
      changedFiles: diffSummary.files,
      rcaFingerprint: fingerprint,
      hypothesis: diagnosis?.rootCause ?? null,
      strategy: evidence.selected,
      targetedTests: evidence.reproductionCommands,
      fullTests: evidence.regressionSelection?.regressionCommands ?? [],
      resultingSHA: attributionResultingSHA !== targetSha ? attributionResultingSHA : null,
      outcome: attributionResultingSHA !== targetSha ? 'mutation-applied' : 'mutation-pending-commit',
    });
    if (
      !diffSummary.files.length ||
      diffSummary.files.length > repairPolicy.maxChangedFiles ||
      diffSummary.lines > repairPolicy.maxChangedLines ||
      diffSummary.files.some((path) => !isPathAllowed(path))
    ) {
      rollback(targetDir, before);
      evidence.outcome = 'blocked';
      evidence.rollback = true;
      evidence.escalation = { required: true, reason: 'historical-rollback-scope-policy' };
      recordOutcome(memory, {
        fingerprint,
        normalizedFailure,
        features,
        rootCause: diagnosis?.rootCause ?? 'unknown',
        rule: historicalRollbackCandidate.rule ?? undefined,
        outcome: 'revert-failure',
        verification: 'historical-rollback-scope-policy',
        provenance: { targetSha, revertedCommit: historicalRollbackCandidate.commitSha },
        preventionRule: 'Reject historical reverts that exceed the bounded rollback scope.',
      });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
      process.exit(6);
    }

    evidence.contaminationGuard = checkVerificationContamination({
      changedPaths: evidence.changedPaths,
      selection: evidence.reproductionSelection,
    });
    evidence.reproductionStabilityAfter = evidence.contaminationGuard.ok
      ? reproduceStable(targetDir, evidence.reproductionCommands, reproduce, { attempts: 2 })
      : null;
    evidence.reproductionAfter = evidence.reproductionStabilityAfter?.lastRun ?? null;
    evidence.regressionSelection = {
      ...evidence.reproductionSelection,
      regressionMode: 'MINIMAL_TARGET_REPEAT',
    };
    evidence.regression = evidence.contaminationGuard.ok
      ? runRegression(targetDir, evidence.regressionSelection.regressionCommands)
      : { ok: false, results: [] };
    const rootCauseProof = {
      required: true,
      reproductionWasFailing: evidence.reproductionStability?.classification === 'REPRODUCIBLE_FAILURE',
      reproductionRecovered: evidence.reproductionStabilityAfter?.classification === 'STABLE_PASS',
      regressionPassed: evidence.regression.ok,
      commandsPresent: evidence.reproductionCommands.length > 0,
    };
    evidence.rootCauseProof = rootCauseProof;
    evidence.recurrenceProof = {
      required: true,
      firstPass: evidence.reproductionStabilityAfter?.runs?.[0]?.ok === true,
      secondPass: evidence.reproductionStabilityAfter?.runs?.[1]?.ok === true,
      firstRun: evidence.reproductionStabilityAfter?.runs?.[0] ?? null,
      secondRun: evidence.reproductionStabilityAfter?.runs?.[1] ?? null,
    };
    const proof = validateRepairProof({ rootCauseProof, recurrenceProof: evidence.recurrenceProof, evidence });
    evidence.repairProof = proof;
    if (!proof.ok) {
      rollback(targetDir, before);
      evidence.outcome = 'revert-failure';
      evidence.rollback = true;
      evidence.escalation = { required: true, reason: escalationReason(proof) };
      recordOutcome(memory, {
        fingerprint,
        normalizedFailure,
        features,
        rootCause: diagnosis?.rootCause ?? 'unknown',
        rule: historicalRollbackCandidate.rule ?? undefined,
        outcome: 'revert-failure',
        verification: 'historical-revert-proof-incomplete',
        provenance: { targetSha, revertedCommit: historicalRollbackCandidate.commitSha },
        preventionRule: preventionRuleFor({ fingerprint, rule: historicalRollbackCandidate.rule ?? 'historical-revert' }),
      });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
      process.exit(7);
    }

    evidence.outcome = 'verified-historical-revert';
    evidence.repairProtocol = completeRepairSession(repairProtocolSession, {
      retestResult: evidence.reproductionStabilityAfter?.classification === 'STABLE_PASS',
      resumePoint: 'REMAINING_REQUIRED_TESTS',
      finalVerification: { targetedRetest: evidence.reproductionStabilityAfter?.classification === 'STABLE_PASS', recurrence: evidence.recurrenceProof?.firstPass === true && evidence.recurrenceProof?.secondPass === true, regression: evidence.regression?.ok === true, exactSHA: evidence.targetSha === targetSha },
    });
    evidence.preventionRule = preventionRuleFor({ fingerprint, rule: historicalRollbackCandidate.rule ?? 'historical-revert' });
    recordOutcome(memory, {
      fingerprint,
      normalizedFailure,
      features,
      rootCause: diagnosis?.rootCause ?? 'unknown',
      rule: historicalRollbackCandidate.rule ?? undefined,
      outcome: 'reverted-repair',
      verification: 'historical-revert-proof+root-cause-proof+recurrence-proof+typecheck+static+build',
      provenance: { targetSha, revertedCommit: historicalRollbackCandidate.commitSha, proof },
      preventionRule: evidence.preventionRule,
    });
    writeMemory(memory);
    writeEvidence(evidencePath, evidence);
    console.log(`AUTO_REPAIR_RESULT=VERIFIED_HISTORICAL_REVERT\\nAUTO_REPAIR_REVERTED_COMMIT=${historicalRollbackCandidate.commitSha}\\nAUTO_REPAIR_FINGERPRINT=${fingerprint}`);
    process.exit(0);
  } catch (error) {
    rollback(targetDir, before);
    evidence.outcome = 'revert-failure';
    evidence.error = String(error?.message ?? error);
    evidence.rollback = true;
    evidence.escalation = { required: true, reason: 'historical-revert-exception' };
    recordOutcome(memory, {
      fingerprint,
      normalizedFailure,
      features,
      rootCause: diagnosis?.rootCause ?? 'unknown',
      rule: historicalRollbackCandidate.rule ?? undefined,
      outcome: 'revert-failure',
      verification: 'historical-revert-exception',
      provenance: { targetSha, revertedCommit: historicalRollbackCandidate.commitSha },
      preventionRule: 'Do not repeat a conflicting historical revert without new evidence.',
    });
    writeMemory(memory);
    writeEvidence(evidencePath, evidence);
    process.exit(8);
  }
}

const externalToolingFailure = features.includes('external-tooling') || diagnosis?.rootCause === 'external-tooling';
if (externalToolingFailure) {
  evidence.outcome = 'blocked-external';
  evidence.externalTooling = {
    sourceMutationAllowed: false,
    reason: 'External security/agent tooling failed before producing a repository finding.',
    policy: 'Do not mutate source code to repair an infrastructure/model capability failure.',
  };
  evidence.escalation = {
    required: true,
    reason: 'external-tooling-failure',
    action: 'Repair or rerun the external provider configuration; keep repository state unchanged.',
  };
  recordOutcome(memory, {
    fingerprint,
    normalizedFailure,
    features,
    rootCause: 'external-tooling',
    outcome: 'blocked-external',
    verification: 'external-tooling-classification',
    provenance: { targetSha },
    preventionRule: 'Never mutate source to remediate an external model/provider/tooling failure; classify it as blocked external infrastructure and require provider-side recovery.',
  });
  writeMemory(memory);
  writeEvidence(evidencePath, evidence);
  console.log('AUTO_REPAIR_RESULT=BLOCKED_EXTERNAL');
  console.log('AUTO_REPAIR_REASON=external-tooling-failure');
  process.exit(0);
}

if (!diagnosisGate.allowed) {
  evidence.outcome = 'proposal-only';
  evidence.escalation = { required: true, reason: 'root-cause-evidence-insufficient' };
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, {
    fingerprint,
    normalizedFailure,
    features,
    rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
    rule: selected?.id,
    outcome: 'proposed',
    verification: 'diagnosis-gate-blocked',
    provenance: { targetSha },
    preventionRule: 'Do not mutate source when causal evidence is weak or ambiguous.',
  });
  writeMemory(memory);
  console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
  console.log('AUTO_REPAIR_REASON=root-cause-evidence-insufficient');
  process.exit(0);
}

if (!selected) {
  evidence.escalation = { required: true, reason: durableLedgerRejected ? 'durable-no-repeat-blocked' : 'no-safe-mutation-candidate' };
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', outcome: 'proposed', verification: 'none', provenance: { targetSha }, preventionRule: 'No safe mutation candidate; escalate with evidence.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=none\nAUTO_REPAIR_FINGERPRINT=${fingerprint}`);
  process.exit(0);
}

const errorOnlyProgrammer = buildErrorOnlyRepairModel({
  log,
  diagnosis,
  selected,
  targetSha,
  failedSha: process.env.FLIXO_FAILURE_SHA || null,
  targetDir,
});
evidence.errorOnlyProgrammer = errorOnlyProgrammer;
if (!errorOnlyProgrammer.repair.mutationAllowed) {
  evidence.outcome = 'proposal-only';
  evidence.escalation = { required: true, reason: 'error-only-programmer-blocked', blockedReasons: errorOnlyProgrammer.blockedReasons };
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, {
    fingerprint,
    normalizedFailure,
    features,
    rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
    rule: selected?.id,
    outcome: 'proposed',
    verification: 'error-only-programmer-blocked',
    provenance: { targetSha, blockedReasons: errorOnlyProgrammer.blockedReasons },
    preventionRule: 'Only mutate source code when the selected repair is tied to the demonstrated current error.',
  });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\\nAUTO_REPAIR_REASON=error-only-programmer-blocked`);
  process.exit(0);
}

const gate = confidenceGate({ selected, features: plan.features, maxFiles: repairPolicy.maxChangedFiles, maxLines: repairPolicy.maxChangedLines });
evidence.confidenceGate = gate;
evidence.v11 = {
  capability: 'CAUSAL-SIMULATION-ADVERSARIAL-PROOF',
  knowledgeGraph: buildRepairKnowledgeGraph({ fingerprint, targetSha, diagnosis, plan }),
};
if (!gate.allowed) {
  evidence.outcome = 'proposal-only';
  evidence.escalation = { required: true, reason: 'confidence-gate-blocked' };
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', rule: selected.id, outcome: 'proposed', verification: 'confidence-gate-blocked', provenance: { targetSha }, preventionRule: 'Require guarded or human-gated repair for this class.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=${selected.id}`);
  process.exit(0);
}

if (!preMutationProof || preMutationProof.protocol !== 'REPAIR-SIMULATION-PROOF-v1' || preMutationProof.status !== 'PROVEN' || preMutationProof.targetSha !== targetSha || preMutationProof.failureFingerprint !== fingerprint || preMutationProof.noMutationApplied !== true) {
  evidence.outcome = 'proposal-only';
  evidence.escalation = { required: true, reason: 'pre-mutation-proof-missing-or-stale' };
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, {
    fingerprint,
    normalizedFailure,
    features,
    rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
    rule: selected.id,
    outcome: 'proposed',
    verification: 'pre-mutation-proof-blocked',
    provenance: { targetSha, preMutationProof: Boolean(preMutationProof) },
    preventionRule: 'Mutation requires a fresh exact-SHA pre-mutation simulation, differential proof, and counterexample exhaustion.',
  });
  writeMemory(memory);
  console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
  console.log('AUTO_REPAIR_REASON=pre-mutation-proof-missing-or-stale');
  process.exit(0);
}
const simulation = preMutationProof.sandboxSimulation;
evidence.simulation = simulation;
evidence.preMutationProof = {
  protocol: preMutationProof.protocol,
  status: preMutationProof.status,
  targetSha: preMutationProof.targetSha,
  failureFingerprint: preMutationProof.failureFingerprint,
  proofCompleteness: preMutationProof.proofCompleteness,
};

const before = snapshot(targetDir);
  const preparedVerification = prepareTargetedVerification(log, plan.features);
  evidence.reproductionSelection = preparedVerification.selection;
  evidence.targetIdentity = preparedVerification.targetIdentity;
  evidence.verificationPlan = preparedVerification.verificationPlan;
  evidence.reproductionCommands = evidence.reproductionSelection.commands;
  evidence.reproductionStability = preparedVerification.reproductionStability ?? null;
  evidence.reproductionBefore = preparedVerification.reproductionStability?.firstRun ?? null;
  if (!preparedVerification.ok) {
    evidence.outcome = 'proposal-only';
    evidence.escalation = { required: true, reason: preparedVerification.reason };
    writeEvidence(evidencePath, evidence);
    recordOutcome(memory, {
      fingerprint,
      normalizedFailure,
      features,
      rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
      rule: selected?.id,
      outcome: 'proposed',
      verification: 'failure-directed-baseline-blocked',
      provenance: { targetSha, targetIdentity: evidence.targetIdentity, reproductionStability: evidence.reproductionStability },
      preventionRule: 'Require an exact, uniquely identified, stable failing target before source mutation.',
    });
    writeMemory(memory);
    console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
    console.log('AUTO_REPAIR_REASON=' + preparedVerification.reason);
    console.log('AUTO_REPAIR_FINGERPRINT=' + fingerprint);
    process.exit(0);
  }

  if (repairActor === 'actionRepairBot') {
    const taskId = process.env.FLIXO_AGENT_TASK ?? process.env.FLIXO_TASK_ID ?? process.env.TARGET_RUN_ID ?? repairSessionId;
    const sandbox = simulateAstRepair({
      repoRoot: targetDir,
      taskId,
      fingerprint,
      targetSha,
      selected,
      checks: evidence.reproductionCommands,
      failureLog: log,
    });
    evidence.actionVaultSandbox = sandbox;
    if (sandbox.status !== 'PASS' || sandbox.patchDigest !== preMutationProof.sandboxSimulation?.patchDigest) {
      evidence.outcome = 'proposal-only';
      evidence.escalation = { required: true, reason: 'action-vault-pre-mutation-sandbox-failed' };
      writeEvidence(evidencePath, evidence);
      recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', rule: selected?.id, outcome: 'proposed', verification: 'action-vault-sandbox-failed', provenance: { targetSha, sandbox }, preventionRule: 'Action Vault mutation requires a passing exact-SHA detached-worktree AST simulation with executed differential checks.' });
      writeMemory(memory);
      console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
      console.log('AUTO_REPAIR_REASON=action-vault-pre-mutation-sandbox-failed');
      process.exit(0);
    }
    repairProtocolSession = Object.freeze({
      ...repairProtocolSession,
      actionVaultMission: {
        ...repairProtocolSession.actionVaultMission,
        sandboxProof: sandbox,
        differentialProof: sandbox.differentialProof ?? sandbox.differential,
        counterexampleProof: sandbox.regressionCounterexamples,

        patchCorrectnessProof: sandbox.patchCorrectnessProof,
        preMutationProof,
      },
    });
    repairProtocolSession = authorizeMutation(repairProtocolSession);
    assertAgentAdmission({ actor: repairActor, branch: protocolBranch, mutation: true, session: repairProtocolSession });
  } else {
    repairProtocolSession = authorizeMutation(repairProtocolSession);
    assertAgentAdmission({ actor: repairActor, branch: protocolBranch, mutation: true, session: repairProtocolSession });
  }


if (repairActor === 'actionRepairBot') {
  const gateCurrentSha = git(['rev-parse', 'HEAD']).trim();
  const plannedChangedPaths = evidence.actionVaultSandbox?.changedFiles ?? preMutationProof.sandboxSimulation?.changedFiles ?? [];
  const candidateDiff = evidence.actionVaultSandbox?.candidateDiff ?? preMutationProof.sandboxSimulation?.candidateDiff ?? '';
  const mutationScope = {
    changedPaths: plannedChangedPaths,
    selectedFiles: fileSelection?.selectedFiles?.map((item) => item.path).filter(Boolean) ?? [],
    testMutation: plannedChangedPaths.some((file) => /(^|\/)(?:tests?|__tests__)\//u.test(file)),
    controlPlaneMutation: plannedChangedPaths.some((file) => /^scripts\/ci\/|^\.github\/workflows\//u.test(file)),
    mainMutation: false,
    gateWeakening: /continue-on-error|test\.(?:skip|only)|describe\.(?:skip|only)|eslint-disable|@ts-(?:ignore|nocheck)/iu.test(candidateDiff),
  };
  const mutationGate = evaluateMutationGate({
    targetSha,
    currentSha: gateCurrentSha,
    failureFingerprint: fingerprint,
    verifierProof: actionVaultVerifierProof,
    cognitiveAwareness,
    rootCauseProof: preMutationProof.rootCauseProof,
    fileSelection,
    programmerTwinParity,
    falsificationReport: programmerTwinReport,
    simulationProof: evidence.actionVaultSandbox ?? preMutationProof.sandboxSimulation,
    differentialProof: preMutationProof.differentialProof,
    patchCorrectness: preMutationProof.patchCorrectness,
    regressionCounterexamples: preMutationProof.regressionCounterexamples,
    mutationScope,
    branch: protocolBranch,
  });
  evidence.mutationGate = mutationGate;
  if (mutationGate.status !== 'PASS') {
    evidence.outcome = 'proposal-only';
    evidence.escalation = { required: true, reason: 'hard-mutation-gate-blocked', blockedReasons: mutationGate.failures };
    writeEvidence(evidencePath, evidence);
    recordOutcome(memory, {
      fingerprint,
      normalizedFailure,
      features,
      rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
      rule: selected?.id,
      outcome: 'proposed',
      verification: 'hard-mutation-gate-blocked',
      provenance: { targetSha, mutationGate },
      preventionRule: 'No source mutation is admissible until every exact-SHA evidence, falsification, simulation, differential, patch and regression obligation passes.',
    });
    writeMemory(memory);
    console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
    console.log('AUTO_REPAIR_REASON=hard-mutation-gate-blocked');
    process.exit(0);
  }
}

try {
  const declaredRepairFiles = selected?.id === 'prepared-source-change'
    ? (selected?.files ?? []).filter(Boolean)
    : [selected?.file].filter(Boolean);
  evidence.errorOnlyMutation = validateErrorOnlyMutation({
    failureLocation: diagnosis?.location?.file ?? selected?.file ?? declaredRepairFiles[0],
    selectedFile: selected?.file ?? declaredRepairFiles[0],
    selectedFiles: declaredRepairFiles,
    changedPaths: declaredRepairFiles,
  });
  evidence.repair = runAstRepair(targetDir, selected);
  const changed = git(['diff', '--binary']);
  if (repairActor === 'actionRepairBot') {
    const actualPatchDigest = createHash('sha256').update(changed, 'utf8').digest('hex');
    const expectedPatchDigest = evidence.actionVaultSandbox?.patchDigest;
    if (!expectedPatchDigest || actualPatchDigest !== expectedPatchDigest) {
      rollback(targetDir, before);
      throw new Error('ACTION_VAULT_ACTUAL_PATCH_DIFFERS_FROM_SIMULATED_PATCH');
    }
    evidence.actionVaultPatchIdentity = { expectedPatchDigest, actualPatchDigest, exactMatch: true, exactSha: targetSha };
  }
  const diffSummary = summarizeDiff(changed);
  evidence.diff = diffSummary;
  evidence.changedPaths = diffSummary.files;
  const declaredAffectedPaths = diagnosis?.affectedPaths ?? (selected?.files?.length ? selected.files : [diagnosis?.location?.file].filter(Boolean));
  evidence.minimalRepairScope = validateMinimalRepairScope({ affectedPaths: declaredAffectedPaths, changedPaths: diffSummary.files });
  evidence.selfCritic = critiqueRepair({
    diff: changed,
    diffSummary,
    plan: selected,
    diagnosis,
    simulation,
    maxChangedFiles: repairPolicy.maxChangedFiles,
    maxChangedLines: repairPolicy.maxChangedLines,
  });
  evidence.v11.knowledgeGraph = buildRepairKnowledgeGraph({
    fingerprint, targetSha, diagnosis, plan, simulation, selfCritic: evidence.selfCritic,
  });
  if (!evidence.selfCritic.ok) {
    rollback(targetDir, before);
    evidence.outcome = 'rolled-back';
    evidence.rollback = true;
    evidence.escalation = { required: true, reason: 'self-critic-blocked' };
    recordOutcome(memory, {
      fingerprint,
      normalizedFailure,
      features,
      rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
      rule: selected.id,
      outcome: 'failure',
      verification: 'self-critic-blocked',
      provenance: { targetSha, changedPaths: diffSummary.files, selfCritic: evidence.selfCritic },
      preventionRule: 'Reject patches that bypass gates, exceed scope, or diverge from the causal target.',
    });
    writeMemory(memory);
    writeEvidence(evidencePath, evidence);
    process.exitCode = 3;
  } else if (!diffSummary.files.length || diffSummary.files.length > repairPolicy.maxChangedFiles || diffSummary.lines > repairPolicy.maxChangedLines || diffSummary.files.some((path) => !isPathAllowed(path))) {
    evidence.outcome = 'blocked';
    evidence.escalation = { required: true, reason: 'scope-policy' };
    rollback(targetDir, before);
    recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', rule: selected.id, outcome: 'blocked', verification: 'scope-policy', provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: 'Reject repairs outside the bounded change policy.' });
    writeMemory(memory);
    writeEvidence(evidencePath, evidence);
    process.exitCode = 2;
  } else {
    evidence.contaminationGuard = checkVerificationContamination({
      changedPaths: evidence.changedPaths,
      selection: evidence.reproductionSelection,
    });
    evidence.reproductionStabilityAfter = evidence.contaminationGuard.ok
      ? reproduceStable(targetDir, evidence.reproductionCommands, reproduce, { attempts: 2 })
      : null;
    evidence.reproductionAfter = evidence.reproductionStabilityAfter?.lastRun ?? null;
    evidence.regressionSelection = {
      ...evidence.reproductionSelection,
      regressionMode: 'MINIMAL_TARGET_REPEAT',
    };
    evidence.regression = evidence.contaminationGuard.ok
      ? runRegression(targetDir, evidence.regressionSelection.regressionCommands)
      : { ok: false, results: [] };
    const rootCauseProof = {
      required: true,
      reproductionWasFailing: evidence.reproductionStability?.classification === 'REPRODUCIBLE_FAILURE',
      reproductionRecovered: evidence.reproductionStabilityAfter?.classification === 'STABLE_PASS',
      regressionPassed: evidence.regression.ok,
      commandsPresent: evidence.reproductionCommands.length > 0,
    };
    evidence.rootCauseProof = rootCauseProof;
    evidence.recurrenceProof = {
      required: true,
      firstPass: evidence.reproductionStabilityAfter?.runs?.[0]?.ok === true,
      secondPass: evidence.reproductionStabilityAfter?.runs?.[1]?.ok === true,
      firstRun: evidence.reproductionStabilityAfter?.runs?.[0] ?? null,
      secondRun: evidence.reproductionStabilityAfter?.runs?.[1] ?? null,
    };
    evidence.causalProof = buildCausalProof({
      diagnosis,
      plan: selected,
      simulation,
      reproductionBefore: evidence.reproductionBefore,
      reproductionAfter: evidence.reproductionAfter,
      regression: evidence.regression,
      recurrenceProof: evidence.recurrenceProof,
      changedPaths: evidence.changedPaths,
      selfCritic: evidence.selfCritic,
    });
    evidence.v11.knowledgeGraph = buildRepairKnowledgeGraph({
      fingerprint, targetSha, diagnosis, plan, simulation,
      selfCritic: evidence.selfCritic,
      causalProof: evidence.causalProof,
    });
    const proof = validateRepairProof({ rootCauseProof, recurrenceProof: evidence.recurrenceProof, evidence });
    evidence.repairProof = proof;
    const verified = proof.ok && evidence.causalProof.ok;
    if (!verified) {
      rollback(targetDir, before);
      evidence.outcome = 'rolled-back';
      evidence.rollback = true;
      evidence.escalation = { required: true, reason: escalationReason(proof) };
      recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'root-cause-or-recurrence-proof-failed', provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: preventionRuleFor({ fingerprint, rule: selected.id }) });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
      process.exitCode = 3;
    } else {
      evidence.outcome = 'verified-repair';
      evidence.repairProtocol = completeRepairSession(repairProtocolSession, {
        retestResult: evidence.reproductionStabilityAfter?.classification === 'STABLE_PASS',
        resumePoint: 'REMAINING_REQUIRED_TESTS',
        finalVerification: { targetedRetest: evidence.reproductionStabilityAfter?.classification === 'STABLE_PASS', recurrence: evidence.recurrenceProof?.firstPass === true && evidence.recurrenceProof?.secondPass === true, regression: evidence.regression?.ok === true, exactSHA: evidence.targetSha === targetSha },
      });
      evidence.preventionRule = preventionRuleFor({ fingerprint, rule: selected.id });
      recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', rule: selected.id, outcome: 'success', verification: 'diagnosis-proof+root-cause-proof+recurrence-proof+typecheck+static+build', provenance: { targetSha, changedPaths: diffSummary.files, proof }, preventionRule: evidence.preventionRule });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
    }
  }
} catch (error) {
  rollback(targetDir, before);
  evidence.outcome = 'rolled-back';
  evidence.error = String(error?.message ?? error);
  evidence.rollback = true;
  evidence.escalation = { required: true, reason: 'repair-exception' };
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'exception', provenance: { targetSha }, preventionRule: 'Do not repeat an exception-producing repair without new evidence.' });
  writeMemory(memory);
  writeEvidence(evidencePath, evidence);
  process.exitCode = 4;
}
