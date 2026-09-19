import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import { fingerprintFailure, normalizeFailure, extractFeatures, loadMemory, findCase, findSimilarCases, rankLessons, scorePlaybook, deriveReusableKnowledge, writeMemory, recordOutcome } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { runAstRepair } from './auto-repair/ast-repair.mjs';
import { reproduce, resolveTargetedTests } from './auto-repair/reproduction.mjs';
import { runRegression } from './auto-repair/regression.mjs';
import { summarizeDiff, writeEvidence } from './auto-repair/evidence.mjs';
import { snapshot, rollback } from './auto-repair/rollback.mjs';
import { findHistoricalRepairCandidate, applyHistoricalRepair, historicalRollbackRecord } from './auto-repair/historical-rollback.mjs';
import { validateRepairProof, preventionRuleFor, escalationReason } from './auto-repair-proof.mjs';
import { simulateRepair } from './auto-repair/simulation.mjs';
import { critiqueRepair } from './auto-repair/self-critic.mjs';
import { buildCausalProof } from './auto-repair/causal-proof.mjs';
import { buildRepairKnowledgeGraph } from './auto-repair/knowledge-graph.mjs';

// Static protocol contract marker: root-cause-proof-reproductionRecovered.
function mutationAttribution({ beforeSha, afterSha, changedFiles = [], rule = null, outcome = 'unknown' } = {}) {
  return {
    schemaVersion: 1,
    beforeSha: beforeSha ?? null,
    afterSha: afterSha ?? null,
    changedFiles: [...new Set(changedFiles)],
    rule,
    outcome,
    exactShaBound: Boolean(beforeSha && afterSha),
    recordedAt: new Date().toISOString(),
  };
}

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const targetDir = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const fingerprint = fingerprintFailure(log);
const normalizedFailure = normalizeFailure(log);
const features = extractFeatures(log);
const evidencePath = process.env.FLIXO_REPAIR_EVIDENCE_PATH ?? '/tmp/flixo-repair-evidence.json';
const diagnosisPath = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';
const git = (args, options = {}) => execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8', ...options });
const targetSha = git(['rev-parse', 'HEAD']).trim();
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

if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint && !historicalRollbackCandidate) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  process.exit(0);
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
const historicalRules = [
  ...(reusableKnowledge.generalizedRules ?? []).map((item) => item.rule).filter(Boolean),
];
const historicalCandidate = plan.candidates.find((candidate) => historicalRules.includes(candidate.id) && candidate.mutate && candidate.confidence >= 90 && !revertedRuleIds.has(candidate.id));
const blockedRuleIds = new Set(blockedLessons.map((item) => item.rule).filter(Boolean));
if (selected?.id && blockedRuleIds.has(selected.id) && !trustedLessons.some((item) => item.rule === selected.id && item.confidence >= 0.85)) selected = null;
if (selected?.id && revertedRuleIds.has(selected.id)) selected = null;
if (historicalCandidate && !blockedRuleIds.has(historicalCandidate.id) && (!selected || scorePlaybook(memory, specialist?.id ?? 'unknown', historicalCandidate.id) >= scorePlaybook(memory, specialist?.id ?? 'unknown', selected.id))) {
  selected = {
    ...historicalCandidate,
    file: selected?.file ?? plan.reasoning?.location?.file ?? null,
  };
}
const evidence = {
  schemaVersion: 6,
  protocol: 'AUTONOMOUS-REPAIR-PROTOCOL-v4',
  fingerprint,
  targetSha,
  features,
  diagnosis,
  specialist,
  candidates: plan.candidates,
  reasoning: plan.reasoning,
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
  allowed: Boolean(diagnosis) && diagnosis.diagnosisQuality === 'strong' && diagnosis.causalConfidence >= 0.75 && !diagnosis.ambiguity && diagnosis.directFailureSignal && reasoningDecision === 'ALLOW_BOUNDED_MUTATION',
};
evidence.diagnosisGate = diagnosisGate;

if (historicalRollbackCandidate && diagnosisGate.allowed) {
  const before = snapshot(targetDir);
  evidence.reproductionSelection = resolveTargetedTests(log, plan.features, { targetDir });
  evidence.reproductionCommands = evidence.reproductionSelection.commands;
  evidence.reproductionBefore = reproduce(targetDir, evidence.reproductionCommands);
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
    evidence.mutationAttribution = mutationAttribution({
      beforeSha: targetSha,
      afterSha: git(['rev-parse', 'HEAD']).trim(),
      changedFiles: diffSummary.files,
      rule: evidence.selected,
      outcome: 'mutation-applied',
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

    evidence.reproductionAfter = reproduce(targetDir, evidence.reproductionCommands);
    evidence.regressionSelection = evidence.reproductionSelection;
    evidence.regression = runRegression(targetDir, evidence.reproductionSelection.regressionCommands);
    const rootCauseProof = {
      required: true,
      reproductionWasFailing: evidence.reproductionBefore.results.length > 0 && !evidence.reproductionBefore.ok,
      reproductionRecovered: evidence.reproductionAfter.results.length > 0 && evidence.reproductionAfter.ok,
      regressionPassed: evidence.regression.ok,
      commandsPresent: evidence.reproductionCommands.length > 0,
    };
    evidence.rootCauseProof = rootCauseProof;
    evidence.recurrenceProof = { required: true, firstPass: false, secondPass: false };
    if (rootCauseProof.commandsPresent && rootCauseProof.reproductionWasFailing && rootCauseProof.reproductionRecovered) {
      const secondReproduction = reproduce(targetDir, evidence.reproductionCommands);
      evidence.recurrenceProof.firstPass = true;
      evidence.recurrenceProof.secondPass = secondReproduction.ok;
      evidence.recurrenceProof.secondRun = secondReproduction;
    }
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
  evidence.escalation = { required: true, reason: 'no-safe-mutation-candidate' };
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown', outcome: 'proposed', verification: 'none', provenance: { targetSha }, preventionRule: 'No safe mutation candidate; escalate with evidence.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=none\nAUTO_REPAIR_FINGERPRINT=${fingerprint}`);
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

const simulation = simulateRepair({
  targetDir,
  plan: selected,
  maxChangedFiles: repairPolicy.maxChangedFiles,
  maxChangedLines: repairPolicy.maxChangedLines,
});
evidence.simulation = simulation;
if (!simulation.ok) {
  evidence.outcome = 'proposal-only';
  evidence.escalation = { required: true, reason: 'pre-mutation-simulation-failed' };
  evidence.v11.knowledgeGraph = buildRepairKnowledgeGraph({
    fingerprint, targetSha, diagnosis, plan, simulation,
  });
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, {
    fingerprint,
    normalizedFailure,
    features,
    rootCause: diagnosis?.rootCause ?? specialist?.id ?? 'unknown',
    rule: selected.id,
    outcome: 'proposed',
    verification: 'pre-mutation-simulation-failed',
    provenance: { targetSha, simulation },
    preventionRule: 'Require an isolated deterministic simulation to pass before source mutation.',
  });
  writeMemory(memory);
  console.log('AUTO_REPAIR_RESULT=PROPOSAL_ONLY');
  console.log('AUTO_REPAIR_REASON=pre-mutation-simulation-failed');
  process.exit(0);
}

const before = snapshot(targetDir);
evidence.reproductionSelection = resolveTargetedTests(log, plan.features, { targetDir });
  evidence.reproductionCommands = evidence.reproductionSelection.commands;
evidence.reproductionBefore = reproduce(targetDir, evidence.reproductionCommands);

try {
  evidence.repair = runAstRepair(targetDir, selected);
  const changed = git(['diff', '--binary']);
  const diffSummary = summarizeDiff(changed);
  evidence.diff = diffSummary;
  evidence.changedPaths = diffSummary.files;
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
    evidence.reproductionAfter = reproduce(targetDir, evidence.reproductionCommands);
    evidence.regressionSelection = evidence.reproductionSelection;
    evidence.regression = runRegression(targetDir, evidence.reproductionSelection.regressionCommands);
    const rootCauseProof = {
      required: true,
      reproductionWasFailing: evidence.reproductionBefore.results.length > 0 && !evidence.reproductionBefore.ok,
      reproductionRecovered: evidence.reproductionAfter.results.length > 0 && evidence.reproductionAfter.ok,
      regressionPassed: evidence.regression.ok,
      commandsPresent: evidence.reproductionCommands.length > 0,
    };
    evidence.rootCauseProof = rootCauseProof;
    evidence.recurrenceProof = { required: true, firstPass: false, secondPass: false };
    if (rootCauseProof.commandsPresent && rootCauseProof.reproductionWasFailing && rootCauseProof.reproductionRecovered) {
      const secondReproduction = reproduce(targetDir, evidence.reproductionCommands);
      evidence.recurrenceProof.firstPass = true;
      evidence.recurrenceProof.secondPass = secondReproduction.ok;
      evidence.recurrenceProof.secondRun = secondReproduction;
    }
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
