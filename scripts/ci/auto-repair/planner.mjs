import { extractFeatures } from './fingerprint.mjs';
import { reasonFailure } from './reasoning.mjs';
import { deriveReusableKnowledge } from '../auto-repair-learning.mjs';
import { execFileSync } from 'node:child_process';
import { preparedPlan } from './prepared-source-change.mjs';
import { inferFailureResolution } from './inference-fallback.mjs';
import { buildErrorOnlyRepairModel } from './error-only-programmer.mjs';
import { buildCausalDiscriminator } from '../action-causal-discriminator.mjs';
import { buildMetaCausalModel } from '../meta-causal-model.mjs';
import fs from 'node:fs';

function loadRepairSteering(targetSha, failureFingerprint) {
  const steeringPath = process.env.FLIXO_REPAIR_STEERING_PATH ?? '/tmp/flixo-repair-strategy.json';
  if (!fs.existsSync(steeringPath)) {
    if (process.env.FLIXO_REPAIR_STEERING_REQUIRED === 'true') throw new Error('REPAIR_STEERING_REQUIRED_MISSING');
    return null;
  }
  let envelope;
  try {
    envelope = JSON.parse(fs.readFileSync(steeringPath, 'utf8'));
  } catch (error) {
    if (process.env.FLIXO_REPAIR_STEERING_REQUIRED === 'true') throw new Error('REPAIR_STEERING_INVALID_JSON', { cause: error });
    return null;
  }
  const steering = envelope.steering;
  if (!steering || steering.authority !== 'DETERMINISTIC_REPAIR_STEERING') {
    if (process.env.FLIXO_REPAIR_STEERING_REQUIRED === 'true') throw new Error('REPAIR_STEERING_AUTHORITY_INVALID');
    return null;
  }
  if (steering.exactShaRequired !== true || steering.targetSha !== targetSha) throw new Error('REPAIR_STEERING_TARGET_SHA_MISMATCH');
  if (failureFingerprint && steering.failureFingerprint && steering.failureFingerprint !== failureFingerprint) {
    throw new Error('REPAIR_STEERING_FINGERPRINT_MISMATCH');
  }
  return steering;
}


const plans = [
  { id: 'external-tooling', features: ['external-tooling'], confidence: 99, mutate: false, commands: [] },
  { id: 'noncanonical-automation', features: ['noncanonical-automation'], confidence: 95, mutate: false, targetScope: 'exact-workflow-or-watch-path', commands: [] },
  { id: 'liveness-contract', features: ['liveness-contract'], confidence: 93, mutate: false, targetScope: 'exact-protocol-or-test', commands: [] },
  { id: 'contract-drift', features: ['contract-drift'], confidence: 92, mutate: false, targetScope: 'exact-contract-surface', commands: [] },
  { id: 'eslint-unused', features: ['lint'], confidence: 92, mutate: true, targetScope: 'exact-file', commands: [] },
  { id: 'prettier-file', features: ['format'], confidence: 90, mutate: true, targetScope: 'exact-file', commands: [] },
  { id: 'typescript-async-contract', features: ['typescript-async-contract'], confidence: 95, mutate: true, targetScope: 'exact-file', commands: [] },
  { id: 'typescript-missing-import', features: ['typescript'], confidence: 91, mutate: true, targetScope: 'exact-file', commands: [] },
  { id: 'typescript-diagnostic', features: ['typescript'], confidence: 88, mutate: false, commands: [['npm', ['run', 'typecheck']]] },
  { id: 'playwright-diagnostic', features: ['playwright'], confidence: 72, mutate: false, commands: [] },
  { id: 'webkit-proposal', features: ['webkit'], confidence: 68, mutate: false, commands: [] },
  { id: 'certification-proposal', features: ['certification'], confidence: 68, mutate: false, commands: [] },
  { id: 'build-diagnostic', features: ['build'], confidence: 82, mutate: false, commands: [['npm', ['run', 'test:build']]] },
];

export function planRepair(log, { historical = [], memory } = {}) {
  const features = extractFeatures(log);
  const targetSha = (() => {
    try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; }
  })();
  const preparedPacketPath = process.env.FLIXO_TASK_AGENT_PACKET_PATH ?? '/tmp/flixo-task-agent/latest.json';
  const prepared = targetSha
    ? preparedPlan(preparedPacketPath, targetSha)
    : { ok: false, reason: 'PREPARED_TARGET_SHA_UNAVAILABLE' };

  const reasoning = reasonFailure(log, { historical });
  const inferenceFallback = inferFailureResolution({
    log,
    memory: memory ?? { cases: [], lessons: [], antiLessons: [], playbooks: [], actionHistory: [] },
    targetSha,
    diagnosis: reasoning,
  });
  const inferenceEligible = inferenceFallback.prediction.eligibleForBoundedMutation === true;
  const reusableKnowledge = memory
    ? deriveReusableKnowledge(memory, { rootCause: reasoning.rootCause, features })
    : null;

  const failureFingerprint = process.env.FLIXO_FAILURE_FINGERPRINT ?? '';
  const steering = loadRepairSteering(targetSha, failureFingerprint);
  const exactCases = (memory?.cases ?? []).filter((item) => item.fingerprint === failureFingerprint);
  const doNotRepeat = [...new Set(exactCases.flatMap((item) => [
    ...(item.failedStrategies ?? []),
    ...(item.outcome === 'FAILED' ? (item.rules ?? []) : []),
  ]).filter(Boolean))];
  const causalDiscriminator = buildCausalDiscriminator({
    failureLog: log,
    exactCases,
    doNotRepeat,
    fingerprint: failureFingerprint,
    targetSha,
  });
  const causalHasSignal = causalDiscriminator.hypotheses.length > 0;
  const causalMutationGate = causalHasSignal && (
    causalDiscriminator.ranking.ambiguous ||
    causalDiscriminator.capabilityScore < 0.68
  );

  const metaCausalModel = buildMetaCausalModel({
    failureLog: log,
    targetSha,
    currentHeadSha: (() => {
      try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return targetSha; }
    })(),
    failedRunId: process.env.TARGET_RUN_ID ?? 'planner-analysis',
    taskId: process.env.FLIXO_TASK_ID ?? 'planner-analysis',
    branch: process.env.FLIXO_MUTATION_BRANCH ?? 'execution',
    strictIdentity: false,
    historicalKnowledge: [],
    exactCases,
    doNotRepeat,
  });
  const metaMutationGate = metaCausalModel.hardBlocks.some((item) =>
    item === 'CURRENT_HEAD_DIFFERS_FROM_TARGET_SHA' ||
    item === 'MUTATION_BRANCH_NOT_EXECUTION' ||
    item === 'EXTERNAL_FAILURE_SOURCE_MUTATION_COLLISION' ||
    item === 'HISTORICALLY_REJECTED_STRATEGY_PRESENT'
  );


  const candidates = plans
    .filter((plan) => plan.features.some((feature) => features.includes(feature)))
    .map((plan) => ({ ...plan, evidence: features }))
    .sort((a, b) => b.confidence - a.confidence);

  if (prepared.ok && reasoning.decision === 'ALLOW_BOUNDED_MUTATION') {
    candidates.push({ ...prepared, evidence: features, rootCause: reasoning.rootCause });
  }

  if (inferenceFallback.hypothesis.strategyId) {
    const inferredPlan = plans.find((item) => item.id === inferenceFallback.hypothesis.strategyId);
    if (inferredPlan) {
      candidates.push({
        ...inferredPlan,
        confidence: Math.max(
          Number(inferredPlan.confidence ?? 0),
          Math.round(inferenceFallback.prediction.confidence * 100),
        ),
        evidence: [...features, 'INFERENTIAL_HISTORY'],
        rootCause: inferenceFallback.hypothesis.rootCause,
        inferred: true,
        inferenceEligible,
        inferenceEvidence: inferenceFallback,
        mutate: inferenceEligible && inferredPlan.mutate === true,
      });
    } else {
      candidates.push({
        id: inferenceFallback.hypothesis.strategyId,
        features,
        confidence: Math.round(inferenceFallback.prediction.confidence * 100),
        mutate: false,
        commands: [],
        evidence: [...features, 'INFERENTIAL_SYNTHESIS'],
        rootCause: inferenceFallback.hypothesis.rootCause,
        inferred: true,
        inferenceEligible: false,
        inferenceEvidence: inferenceFallback,
        proposalOnly: true,
      });
    }
  }

  const repairModelByCandidate = new Map(
    candidates.map((candidate) => [
      candidate.id,
      buildErrorOnlyRepairModel({ log, diagnosis: reasoning, selected: candidate, targetSha }),
    ]),
  );

  /*
   * Error-Only Programmer Model is a pre-mutation programming gate. It never
   * mutates code; it only admits a deterministic repair candidate tied to the
   * current demonstrated source error.
   */
  const safeByRule = new Map(
    candidates
      .filter((candidate) => {
        const model = repairModelByCandidate.get(candidate.id);
        return candidate.mutate &&
          candidate.confidence >= 90 &&
          (candidate.id !== 'prepared-source-change' || candidate.deterministicProof === true) &&
          (candidate.id === 'prepared-source-change' || model?.repair.mutationAllowed === true);
      })
      .map((candidate) => [
        candidate.id,
        { ...candidate, errorOnlyModel: repairModelByCandidate.get(candidate.id) },
      ]),
  );

  const causalSelectedRule = causalDiscriminator.ranking.selectedStrategy;
  const useCausalSelection = !causalMutationGate && Boolean(causalSelectedRule);
  const steeringPreferredRule = steering?.steeringMode === 'BOUNDED_SOURCE_REPAIR'
    ? (steering.preferredRepairRules ?? []).find((ruleId) => candidates.some((candidate) => candidate.id === ruleId))
    : null;
  const selectedRule = steeringPreferredRule
    ?? (prepared.ok && reasoning.decision === 'ALLOW_BOUNDED_MUTATION'
      ? 'prepared-source-change'
      : useCausalSelection
        ? causalSelectedRule
        : /TS1064\b|return type of an async function|Did you mean to write ['"]?Promise/iu.test(log)
          ? 'typescript-async-contract'
          : /TS2304\b|Cannot find name ["']/iu.test(log)
          ? 'typescript-missing-import'
          : inferenceEligible && inferenceFallback.hypothesis.strategyId
            ? inferenceFallback.hypothesis.strategyId
            : reasoning.rootCause === 'format'
              ? 'prettier-file'
              : reasoning.rootCause === 'lint'
                ? 'eslint-unused'
                : reasoning.rootCause);


  const requiresSourceLocation = selectedRule === 'prettier-file' || selectedRule === 'eslint-unused';
  const selectedCandidate =
    safeByRule.get(selectedRule)
    ?? candidates.find((candidate) =>
      candidate.inferred === true &&
      candidate.inferenceEligible === true &&
      candidate.mutate === true &&
      candidate.confidence >= 90 &&
      candidate.id === inferenceFallback.hypothesis.strategyId,
    )
    ?? null;

  const steeringSelectionAllowed = !steering || steering.steeringMode === 'BOUNDED_SOURCE_REPAIR';
  const fallbackSelectionAllowed = steeringSelectionAllowed && !causalMutationGate && !metaMutationGate && (inferenceEligible || reasoning.decision === 'ALLOW_BOUNDED_MUTATION');
  const selected = fallbackSelectionAllowed &&
    selectedCandidate &&
    (!requiresSourceLocation ||
      selectedRule === 'prepared-source-change' ||
      Boolean(reasoning.location?.file))
    ? {
      ...selectedCandidate,
      file: selectedCandidate.id === 'prepared-source-change'
        ? selectedCandidate.file
        : reasoning.location?.file ?? null,
      symbol: selectedCandidate.id === 'typescript-missing-import'
        ? String(log.match(/Cannot find name ["']([^"']+)["']/iu)?.[1] ?? '').trim()
        : undefined,
      diagnosticCode: selectedCandidate.id === 'typescript-missing-import' ? 'TS2304' : selectedCandidate.id === 'typescript-async-contract' ? 'TS1064' : undefined,
      diagnosticLine: reasoning.location?.line ?? null,
      learning: reusableKnowledge,
    }
    : null;

  return {
    features,
    prepared: {
      ok: prepared.ok,
      reason: prepared.reason ?? null,
      files: prepared.files ?? prepared.changes?.map((item) => item.path) ?? [],
    },
    causalDiscriminator,
    causalMutationGate,
    metaCausalModel,
    metaMutationGate,
    steering,
    steeringSelectionAllowed,
    steeringPreferredRule,
    candidates,
    selected,
    blockedReason:
      reasoning.decision === 'BLOCK_EXTERNAL'
        ? 'external-tooling'
        : metaMutationGate
          ? 'meta-causal-control-incoherence'
          : causalMutationGate
          ? 'causal-discriminator-ambiguous'
          : selected
          ? null
          : inferenceFallback.hypothesis.novelty === 'NEW_HYPOTHESIS'
            ? 'new-hypothesis-proposal-only'
            : reasoning.ambiguity
              ? 'ambiguous-causality'
              : null,
    reasoning,
    reusableKnowledge,
    inferenceFallback,
  };
}
