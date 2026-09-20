import { extractFeatures } from './fingerprint.mjs';
import { reasonFailure } from './reasoning.mjs';
import { deriveReusableKnowledge } from '../auto-repair-learning.mjs';
import { execFileSync } from 'node:child_process';
import { preparedPlan } from './prepared-source-change.mjs';
import { inferFailureResolution } from './inference-fallback.mjs';
import { buildErrorOnlyRepairModel } from './error-only-programmer.mjs';

const plans = [
  { id: 'external-tooling', features: ['external-tooling'], confidence: 99, mutate: false, commands: [] },
  { id: 'eslint-unused', features: ['lint'], confidence: 92, mutate: true, targetScope: 'exact-file', commands: [] },
  { id: 'prettier-file', features: ['format'], confidence: 90, mutate: true, targetScope: 'exact-file', commands: [] },
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

  const selectedRule = prepared.ok && reasoning.decision === 'ALLOW_BOUNDED_MUTATION'
    ? 'prepared-source-change'
    : inferenceEligible && inferenceFallback.hypothesis.strategyId
      ? inferenceFallback.hypothesis.strategyId
      : reasoning.rootCause === 'format'
        ? 'prettier-file'
        : reasoning.rootCause === 'lint'
          ? 'eslint-unused'
          : reasoning.rootCause;

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

  const fallbackSelectionAllowed = inferenceEligible || reasoning.decision === 'ALLOW_BOUNDED_MUTATION';
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
    candidates,
    selected,
    blockedReason:
      reasoning.decision === 'BLOCK_EXTERNAL'
        ? 'external-tooling'
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
