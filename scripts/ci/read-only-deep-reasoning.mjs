#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { buildCausalDiscriminator } from './action-causal-discriminator.mjs';
import { buildMetaCausalModel } from './meta-causal-model.mjs';
import { buildRepairIntelligenceMirror } from './read-only-repair-intelligence.mjs';
import { READ_ONLY_POWER_PROFILE } from './read-only-power-profile.mjs';

const clamp = (value, min=0, max=1) => Math.max(min, Math.min(max, Number(value) || 0));
const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value ?? ''));
const hash = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

const ROOT_CAUSE_CLASSES = Object.freeze([
  'INTERNAL_CONTRACT',
  'INTERNAL_CODE',
  'AUTOMATION_CONTROL_FAILURE',
  'BLOCKED_EXTERNAL',
  'SECURITY_SIGNAL',
  'DOWNSTREAM_FAILURE',
  'STALE_EVIDENCE',
  'CANCELLED_SUPERSEDED',
  'UNKNOWN_RCA',
]);

const CLASS_PATTERNS = Object.freeze({
  INTERNAL_CONTRACT: [/CI contract failed/i, /contract drift/i, /contract mismatch/i, /validator/i],
  INTERNAL_CODE: [/TypeError/i, /ReferenceError/i, /SyntaxError/i, /TS\d+/i, /eslint/i, /build failed/i],
  AUTOMATION_CONTROL_FAILURE: [/watchdog/i, /green gate/i, /merge gate/i, /dispatch/i, /concurrency/i],
  BLOCKED_EXTERNAL: [/CAPIError/i, /SessionModelError/i, /requested model is not supported/i, /rate limit/i, /quota/i, /provider/i],
  SECURITY_SIGNAL: [/code scanning/i, /codeql/i, /advanced security/i, /security baseline/i, /security review/i],
  DOWNSTREAM_FAILURE: [/fail closed/i, /required workflow/i, /upstream/i, /dependency red/i],
});

const causalEdgesFor = (item) => {
  const edges = [];
  if (item.workflow) edges.push({ from: 'incident', to: 'workflow:' + item.workflow, relation: 'OBSERVED_IN' });
  if (item.runId != null) edges.push({ from: 'workflow:' + item.workflow, to: 'run:' + item.runId, relation: 'MATERIALIZED_AS' });
  if (item.headSha) edges.push({ from: 'run:' + item.runId, to: 'sha:' + item.headSha, relation: 'OBSERVED_AT_SHA' });
  for (const feature of item.features ?? []) {
    edges.push({ from: 'run:' + item.runId, to: 'feature:' + feature, relation: 'EXHIBITS' });
  }
  if (item.upstreamWorkflow) {
    edges.push({ from: 'run:' + item.runId, to: 'workflow:' + item.upstreamWorkflow, relation: 'DOWNSTREAM_OF' });
  }
  return edges;
};

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[0-9a-f]{40}/gu, '<sha>')
    .replace(/\b\d+\b/gu, '<n>')
    .replace(/\s+/gu, ' ')
    .trim();
}

function evidenceSupportsClass(evidence, className) {
  const text = normalizeText([
    evidence?.classification,
    evidence?.workflow,
    ...(evidence?.features ?? []),
    ...(evidence?.salientEvidence ?? []),
    evidence?.reason,
  ].join(' '));
  return (CLASS_PATTERNS[className] ?? []).filter((pattern) => pattern.test(text)).length;
}

function buildEvidenceDiversity(observed, historicalSignals, securityFindings) {
  const dimensions = {
    runtime: observed.some((item) => item.runId != null),
    logs: observed.some((item) => Array.isArray(item.salientEvidence) && item.salientEvidence.length > 0),
    temporal: observed.some((item) => item.updatedAt),
    sha: observed.some((item) => exactSha(item.headSha)),
    historical: Number(historicalSignals?.memoryLessons?.length ?? 0) > 0 || Number(historicalSignals?.knownRootCauses?.length ?? 0) > 0,
    security: Array.isArray(securityFindings) && securityFindings.length > 0,
    workflowGraph: new Set(observed.map((item) => item.workflow).filter(Boolean)).size > 1,
  };
  const present = Object.values(dimensions).filter(Boolean).length;
  return {
    dimensions,
    present,
    total: Object.keys(dimensions).length,
    diversity: Number((present / Object.keys(dimensions).length).toFixed(3)),
  };
}

function buildTimeline(observed) {
  return [...observed]
    .filter((item) => item.updatedAt || item.runId != null)
    .sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))
    .map((item, index) => ({
      order: index + 1,
      runId: item.runId ?? null,
      workflow: item.workflow ?? null,
      updatedAt: item.updatedAt ?? null,
      sha: item.headSha ?? null,
      classification: item.classification ?? null,
      upstreamWorkflow: item.upstreamWorkflow ?? null,
    }));
}

function buildHypothesis(observed, className, currentSha) {
  const matching = observed.filter((item) => item.classification === className || evidenceSupportsClass(item, className) > 0);
  const current = matching.filter((item) => item.headSha === currentSha).length;
  const support = matching.length;
  const direct = observed.filter((item) => item.classification === className).length;
  const contradictions = observed.filter((item) =>
    item.classification === 'STALE_EVIDENCE' && item.headSha === currentSha
  ).length;
  const diversity = new Set(matching.map((item) => item.workflow).filter(Boolean)).size;
  const score = clamp(
    0.24 +
    Math.min(0.28, direct * 0.10) +
    Math.min(0.18, current * 0.06) +
    Math.min(0.16, diversity * 0.08) -
    Math.min(0.20, contradictions * 0.05)
  );
  const evidenceRefs = matching.slice(0, 8).map((item) => ({
    runId: item.runId ?? null,
    workflow: item.workflow ?? null,
    classification: item.classification ?? null,
    headSha: item.headSha ?? null,
    evidence: (item.salientEvidence ?? []).slice(0, 3),
  }));
  return {
    id: 'H-' + className,
    className,
    status: support > 0 ? 'SUPPORTED' : 'UNSUPPORTED',
    supportCount: support,
    directMatches: direct,
    currentShaMatches: current,
    workflowDiversity: diversity,
    score: Number(score.toFixed(3)),
    evidenceRefs,
    contradictions: contradictions ? ['CURRENT_SHA_HAS_STALE_EVIDENCE_SIGNAL'] : [],
    disconfirmingQuestion: className === 'DOWNSTREAM_FAILURE'
      ? 'Does an independent upstream failure exist before this workflow, on the same SHA?'
      : className === 'BLOCKED_EXTERNAL'
        ? 'Can the provider signature be independently reproduced without repository mutation?'
        : className === 'INTERNAL_CONTRACT'
          ? 'Does the validator/contract fail independently when the same exact SHA is evaluated?'
          : className === 'AUTOMATION_CONTROL_FAILURE'
            ? 'Does the control-plane path fail when its upstream required checks are green?'
            : className === 'SECURITY_SIGNAL'
              ? 'Is there a concrete alert/vulnerability record rather than merely a security workflow failure?'
              : 'Can the same failure be reproduced from the implicated source or contract?',
    counterfactualQuestion: className === 'DOWNSTREAM_FAILURE'
      ? 'Would the downstream failure disappear if the upstream red condition were removed?'
      : 'Would the incident still exist if this candidate cause were removed?',
  };
}

function falsifyHypothesis(hypothesis, observed, currentSha) {
  const disconfirming = [];
  let surviving = true;
  if (hypothesis.className === 'DOWNSTREAM_FAILURE') {
    const hasUpstream = observed.some((item) =>
      item.headSha === currentSha &&
      item.classification !== 'DOWNSTREAM_FAILURE' &&
      item.classification !== 'CANCELLED_SUPERSEDED' &&
      item.classification !== 'STALE_EVIDENCE' &&
      item.updatedAt
    );
    if (!hasUpstream) {
      disconfirming.push('NO_CURRENT_SHA_UPSTREAM_EVENT_FOUND');
      surviving = false;
    }
  }
  if (hypothesis.className === 'BLOCKED_EXTERNAL') {
    const internalEvidence = observed.some((item) =>
      item.headSha === currentSha &&
      ['INTERNAL_CONTRACT', 'INTERNAL_CODE', 'AUTOMATION_CONTROL_FAILURE'].includes(item.classification)
    );
    if (internalEvidence && !observed.some((item) => item.classification === 'BLOCKED_EXTERNAL')) {
      disconfirming.push('NO_DIRECT_PROVIDER_EVENT');
      surviving = false;
    }
  }
  if (hypothesis.className === 'INTERNAL_CONTRACT') {
    const externalOnly = observed.length > 0 && observed.every((item) =>
      ['BLOCKED_EXTERNAL', 'STALE_EVIDENCE', 'CANCELLED_SUPERSEDED'].includes(item.classification)
    );
    if (externalOnly) {
      disconfirming.push('NO_INTERNAL_CONTRACT_EVIDENCE');
      surviving = false;
    }
  }
  if (hypothesis.currentShaMatches === 0 && hypothesis.className !== 'STALE_EVIDENCE') {
    disconfirming.push('NO_CURRENT_SHA_SUPPORT');
    surviving = false;
  }
  return {
    hypothesisId: hypothesis.id,
    status: surviving ? 'SURVIVES_CURRENT_FALSIFICATION' : 'FALSIFIED_OR_UNSUPPORTED',
    tests: [
      {
        question: hypothesis.disconfirmingQuestion,
        result: surviving ? 'NOT_DISPROVEN' : 'DISPROVEN_OR_MISSING_EVIDENCE',
      },
      {
        question: hypothesis.counterfactualQuestion,
        result: 'REQUIRES_CONTROLLED_RECOMPUTATION',
      },
    ],
    disconfirming,
  };
}

function counterfactualFor(hypothesis, observed, currentSha) {
  const removed = observed.filter((item) => item.classification !== hypothesis.className);
  const before = observed.length;
  const after = removed.filter((item) => item.headSha === currentSha).length;
  let implication = 'UNRESOLVED';
  if (before > 0 && after === 0) implication = 'COUNTERFACTUAL_SUPPORTS_SINGLE_CAUSE';
  else if (after < before) implication = 'COUNTERFACTUAL_REDUCES_INCIDENT_SURFACE';
  else if (after === before) implication = 'COUNTERFACTUAL_HAS_NO_OBSERVED_EFFECT';
  return {
    hypothesisId: hypothesis.id,
    removedClass: hypothesis.className,
    currentShaObservationsBefore: observed.filter((item) => item.headSha === currentSha).length,
    currentShaObservationsAfterRemoval: after,
    implication,
    caveat: 'Counterfactual is a model-based reduction over observed classifications, not a live repository experiment.',
  };
}

export function buildDeepInference({
  executionSha = '',
  observed = [],
  historicalSignals = {},
  securityFindings = [],
  recurringPatterns = [],
  downstreamFailures = [],
  staleEvidence = [],
  fullRepairIntelligence = true,
} = {}) {
  if (!exactSha(executionSha)) throw new Error('DEEP_REASONING_EXACT_SHA_REQUIRED');

  const safeObserved = Array.isArray(observed) ? observed : [];
  const graphNodes = new Map();
  const graphEdges = [];

  for (const item of safeObserved) {
    for (const edge of causalEdgesFor(item)) {
      graphEdges.push(edge);
      graphNodes.set(edge.from, true);
      graphNodes.set(edge.to, true);
    }
  }

  const timeline = buildTimeline(safeObserved);
  const diversity = buildEvidenceDiversity(safeObserved, historicalSignals, securityFindings);
  const causalLog = safeObserved
    .flatMap((item) => [
      item.workflow,
      item.classification,
      item.reason,
      ...(item.features ?? []),
      ...(item.salientEvidence ?? []),
    ].filter(Boolean))
    .join('\n');
  const firstCurrentRun = safeObserved.find((item) => item.headSha === executionSha && item.runId != null)?.runId ?? 'READ_ONLY';
  const repairLog = safeObserved
    .filter((item) => item.headSha === executionSha)
    .flatMap((item) => item.salientEvidence ?? [])
    .join('\n');
  const causalDiscriminator = buildCausalDiscriminator({
    failureLog: causalLog,
    exactCases: [],
    doNotRepeat: [],
    fingerprint: safeObserved.find((item) => item.fingerprint)?.fingerprint ?? '',
    targetSha: executionSha,
  });
  const metaCausalModel = buildMetaCausalModel({
    failureLog: causalLog,
    targetSha: executionSha,
    currentHeadSha: executionSha,
    failedRunId: String(firstCurrentRun),
    taskId: 'READ_ONLY_INVESTIGATION:' + executionSha,
    branch: 'execution',
    strictIdentity: true,
    historicalKnowledge: historicalSignals.memoryLessons ?? [],
    exactCases: [],
    doNotRepeat: [],
  });
  const repairIntelligence = repairLog
    ? buildRepairIntelligenceMirror({
        failureLog: repairLog,
        targetSha: executionSha,
        historicalSignals,
        full: fullRepairIntelligence,
      })
    : null;
  const classes = ROOT_CAUSE_CLASSES.map((className) => buildHypothesis(safeObserved, className, executionSha))
    .filter((item) => item.supportCount > 0 || item.className === 'UNKNOWN_RCA')
    .sort((a, b) => b.score - a.score || b.currentShaMatches - a.currentShaMatches);

  const falsification = classes.map((hypothesis) => falsifyHypothesis(hypothesis, safeObserved, executionSha));
  const counterfactuals = classes.map((hypothesis) => counterfactualFor(hypothesis, safeObserved, executionSha));

  const surviving = classes.filter((hypothesis) =>
    falsification.find((item) => item.hypothesisId === hypothesis.id)?.status === 'SURVIVES_CURRENT_FALSIFICATION'
  );
  const top = surviving[0] ?? classes[0] ?? null;
  const runnerUp = surviving[1] ?? classes[1] ?? null;
  const separation = top && runnerUp ? clamp(top.score - runnerUp.score, 0, 1) : top ? 0.5 : 0;
  const independentSources = new Set([
    ...(top?.evidenceRefs ?? []).map((item) => item.workflow).filter(Boolean),
    ...((historicalSignals.knownRootCauses ?? []).slice(0, 5).map((item) => item.category).filter(Boolean)),
    ...(securityFindings.map((item) => item.tool).filter(Boolean)),
  ]).size;
  const evidenceConfidence = top
    ? clamp((top.score * 0.50) + (diversity.diversity * 0.20) + (Math.min(1, independentSources / 4) * 0.15) + (separation * 0.15))
    : 0;

  let causalStatus = 'UNKNOWN_RCA';
  if (top && top.className === 'BLOCKED_EXTERNAL') causalStatus = 'EXTERNAL_BLOCKED';
  else if (top && top.className === 'DOWNSTREAM_FAILURE') causalStatus = 'DOWNSTREAM';
  else if (top && top.className !== 'UNKNOWN_RCA' && top.currentShaMatches > 0 && separation >= 0.12 && evidenceConfidence >= 0.65) causalStatus = 'CANDIDATE_ROOT_CAUSE';

  return {
    protocol: 'FLIXO-DEEP-READ-ONLY-INFERENCE-v1',
    executionSha,
    powerProfile: READ_ONLY_POWER_PROFILE.profile,
    graph: {
      nodes: [...graphNodes.keys()].sort(),
      edges: graphEdges,
      nodeCount: graphNodes.size,
      edgeCount: graphEdges.length,
    },
    timeline,
    evidenceDiversity: diversity,
    causalDiscriminator,
    metaCausalModel,
    repairIntelligence,
    hypotheses: classes,
    falsification,
    counterfactuals,
    synthesis: {
      selectedHypothesis: top?.id ?? null,
      selectedClass: top?.className ?? null,
      runnerUpHypothesis: runnerUp?.id ?? null,
      separation: Number(separation.toFixed(3)),
      independentEvidenceSources: independentSources,
      confidence: Number(evidenceConfidence.toFixed(3)),
      status: causalStatus,
      requiresIndependentVerification: true,
      noMutationAuthority: true,
    },
    knownContext: {
      recurringPatterns: recurringPatterns.slice(0, 20),
      downstreamFailures: downstreamFailures.slice(0, 20),
      staleEvidence: staleEvidence.slice(0, 20),
      openSecurityFindings: securityFindings.length,
    },
    nextEvidence: top
      ? [
          top.disconfirmingQuestion,
          top.counterfactualQuestion,
          'Trace the implicated workflow/script/contract dependencies.',
          'Compare the implicated surface against the last known successful exact SHA.',
        ]
      : [
          'Acquire complete current exact-SHA runtime evidence.',
          'Capture missing failure logs before drawing a root-cause conclusion.',
        ],
    decisionPolicy: 'The deep investigator produces hypotheses and falsification evidence only. It cannot mutate source, repair, merge, certify, or override exact-SHA governance.',
    digest: hash(JSON.stringify({
      executionSha,
      top: top?.id ?? null,
      confidence: evidenceConfidence,
      graphEdges,
      recurringPatterns: recurringPatterns.slice(0, 20),
    })),
  };
}
