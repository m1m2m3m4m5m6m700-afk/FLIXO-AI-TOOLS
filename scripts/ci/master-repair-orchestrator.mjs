#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildDeepInference } from './read-only-deep-reasoning.mjs';
import { buildFusion } from './read-only-knowledge-fusion.mjs';
import { buildTeachingPacket } from './repair-teaching-sessions.mjs';
import { buildRepairKnowledgeGraph } from './auto-repair/knowledge-graph.mjs';
import { buildFiveXRepairCycleState } from './read-only-power-profile.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);
const arg = (name, fallback = '') => String(args[name] ?? process.env[name] ?? fallback).trim();

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
function readJson(file) {
  const raw = readText(file);
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function sha(value) { return /^[a-f0-9]{40}$/iu.test(String(value ?? '')); }
function fingerprint(value) { return /^[a-f0-9]{64}$/iu.test(String(value ?? '')); }
function digest(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function observedEvidence({ targetSha, runId, fp, failureLog, diagnosis, scout, strategy, rootProof, rcaManifest, historicalLearning, teaching }) {
  const rows = [];
  const push = (source, classification, payload, salientEvidence = []) => {
    const payloadSha = String(payload?.targetSha ?? payload?.target_sha ?? targetSha);
    rows.push({
      source,
      workflow: source,
      classification,
      headSha: payloadSha,
      runId,
      fingerprint: fp,
      salientEvidence: salientEvidence.filter(Boolean).slice(0, 8),
      features: [source, classification],
      reason: salientEvidence[0] ?? classification,
    });
  };
  push('FAILED_RUN_LOG', 'INTERNAL_CONTRACT', { targetSha }, failureLog.split(/\r?\n/).filter(Boolean).slice(0, 8));
  push('READ_ONLY_SCOUT', 'INTERNAL_CONTRACT', scout, [
    scout?.scannedSha,
    scout?.classification,
    scout?.summary,
    ...(scout?.findings ?? []).slice?.(0, 3).map((x) => x?.message ?? x?.id)
  ]);
  push('DIAGNOSIS', 'INTERNAL_CONTRACT', diagnosis, [
    diagnosis?.rootCause,
    diagnosis?.trigger,
    diagnosis?.violatedInvariant,
    diagnosis?.location?.file,
  ]);
  push('ROOT_CAUSE_PROOF', 'INTERNAL_CONTRACT', rootProof, [
    rootProof?.status,
    rootProof?.proofClaims?.ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL ? 'failure-linked' : null,
    rootProof?.proofClaims?.LOCATION_LINKED_TO_CAUSE ? 'location-linked' : null,
    rootProof?.proofClaims?.MECHANISM_EXPLAINED ? 'mechanism-explained' : null,
    rootProof?.proofClaims?.ALTERNATIVES_CHALLENGED ? 'alternatives-challenged' : null,
  ]);
  push('RCA_MANIFEST', 'INTERNAL_CONTRACT', rcaManifest, [
    rcaManifest?.protocol,
    rcaManifest?.root_cause_analysis?.primary_cause,
    rcaManifest?.root_cause_analysis?.invariant_violated,
    ...(rcaManifest?.root_cause_analysis?.alternative_hypotheses ?? []).slice(0, 3).map((x) => x?.id ?? x?.hypothesis ?? x?.title),
  ]);
  push('REPAIR_STRATEGY', 'DOWNSTREAM_FAILURE', strategy, [
    strategy?.strategyId,
    strategy?.reasoning?.rootCause,
    strategy?.teachingEscalation === true ? 'teaching-escalation' : null,
    strategy?.twin?.disposition,
  ]);
  push('HISTORICAL_LEARNING', 'DOWNSTREAM_FAILURE', historicalLearning, [
    historicalLearning?.protocol,
    historicalLearning?.status,
    historicalLearning?.historicalMatchCount,
  ]);
  push('TEACHING_PACKET', 'DOWNSTREAM_FAILURE', teaching, [
    teaching?.protocol,
    teaching?.closure?.result,
    ...(teaching?.operatingRules ?? []).slice(0, 4),
  ]);
  push('MEMORY_STATE', 'HISTORICAL_CONTEXT', { targetSha }, ['memory-provenance-bound']);
  push('KNOWLEDGE_ARBITRATION', 'INTERNAL_CONTRACT', { targetSha }, ['knowledge-fusion-bound']);
  return rows;
}

function checkEvidence(rows, targetSha) {
  const required = ['FAILED_RUN_LOG', 'READ_ONLY_SCOUT', 'DIAGNOSIS', 'ROOT_CAUSE_PROOF', 'RCA_MANIFEST'];
  const missing = required.filter((source) => !rows.some((row) => row.source === source));
  const shaMismatches = rows
    .filter((row) => row.headSha && row.headSha !== targetSha)
    .map((row) => row.source);
  return {
    requiredSources: required,
    presentSources: rows.map((row) => row.source),
    missingSources: missing,
    shaMismatches,
    sourceCount: rows.length,
    sourceDiversity: new Set(rows.map((row) => row.source)).size,
  };
}

function buildHypotheses({ rcaManifest, deep }) {
  const manifest = Array.isArray(rcaManifest?.root_cause_analysis?.alternative_hypotheses)
    ? rcaManifest.root_cause_analysis.alternative_hypotheses
    : [];
  const deepHypotheses = Array.isArray(deep?.hypotheses) ? deep.hypotheses : [];
  const merged = [
    ...manifest.map((item, index) => ({
      id: String(item?.id ?? ('RCA_MANIFEST_H' + (index + 1))),
      statement: String(item?.hypothesis ?? item?.title ?? item?.description ?? 'unspecified'),
      source: 'RCA_MANIFEST',
      supported: true,
    })),
    ...deepHypotheses.map((item) => ({
      id: String(item?.id ?? item?.hypothesisId ?? 'DEEP_HYPOTHESIS'),
      statement: String(item?.summary ?? item?.className ?? item?.description ?? 'unspecified'),
      source: 'DEEP_REASONING',
      supported: item?.status !== 'FALSIFIED_OR_UNSUPPORTED',
    })),
  ];
  const byId = new Map();
  for (const item of merged) {
    const existing = byId.get(item.id);
    if (!existing || (item.supported && !existing.supported)) byId.set(item.id, item);
  }
  return [...byId.values()].slice(0, 12);
}

function knowledgeAuthorityCheck(rootProof, strategy) {
  return Boolean(rootProof?.sourceMutationAllowed === false) && Boolean(strategy?.targetSha);
}
function teachingTargetCheck(rootProof, strategy, targetSha) {
  return rootProof?.targetSha === targetSha || strategy?.targetSha === targetSha;
}

function buildCounterexampleChecks({ strategy, rootProof, deep, targetSha }) {
  return [
    { id: 'CURRENT_SHA_MATCH', pass: strategy?.targetSha === targetSha && rootProof?.targetSha === targetSha },
    { id: 'FAILURE_TO_CAUSE_LINK', pass: rootProof?.proofClaims?.ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL === true },
    { id: 'LOCATION_TO_CAUSE_LINK', pass: rootProof?.proofClaims?.LOCATION_LINKED_TO_CAUSE === true },
    { id: 'MECHANISM_EXPLAINED', pass: rootProof?.proofClaims?.MECHANISM_EXPLAINED === true },
    { id: 'ALTERNATIVES_CHALLENGED', pass: rootProof?.proofClaims?.ALTERNATIVES_CHALLENGED === true },
    { id: 'DEEP_FALSIFICATION_PRESENT', pass: Array.isArray(deep?.falsification) && deep.falsification.length >= 10 },
    { id: 'TWIN_DISPOSITION_EXPLICIT', pass: Boolean(strategy?.twin?.disposition) },
    { id: 'NO_STALE_EVIDENCE', pass: !deep?.knownContext?.staleEvidence?.length },
    { id: 'STRATEGY_TARGET_BOUND', pass: strategy?.targetSha === targetSha && Boolean(strategy?.strategyId) },
    { id: 'KNOWLEDGE_PROOF_AUTHORITY', pass: knowledgeAuthorityCheck(rootProof, strategy) },
    { id: 'HISTORICAL_PROVENANCE_PRESENT', pass: Boolean(deep?.knownContext) || Boolean(strategy?.strategyId) },
    { id: 'TEACHING_BOUND_TO_TARGET', pass: teachingTargetCheck(rootProof, strategy, targetSha) },
  ];
}

export async function buildMasterRepairPacket({
  targetSha = arg('sha', process.env.FLIXO_EXPECTED_TARGET_SHA),
  currentSha = arg('current-sha', process.env.FLIXO_CURRENT_TARGET_SHA ?? targetSha),
  runId = arg('run-id', process.env.TARGET_RUN_ID),
  fp = arg('fingerprint', process.env.FLIXO_FAILURE_FINGERPRINT),
  failureLogPath = arg('log', process.env.FLIXO_FAILURE_LOG),
  diagnosisPath = arg('diagnosis', '/tmp/flixo-root-cause.json'),
  scoutPath = arg('scout', '/tmp/flixo-scout-report.json'),
  strategyPath = arg('strategy', '/tmp/flixo-repair-strategy.json'),
  rootProofPath = arg('root-proof', '/tmp/action-root-cause-proof.json'),
  rcaManifestPath = arg('rca-manifest', '/tmp/flixo-rca-manifest.json'),
  historicalLearningPath = arg('historical', '/tmp/flixo-historical-learning.json'),
  teachingPath = arg('teaching', '/tmp/flixo-teaching-sessions.json'),
  memoryPath = arg('memory', process.env.FLIXO_REPAIR_MEMORY || '/tmp/flixo-repair-memory.json'),
} = {}) {
  if (!sha(targetSha)) throw new Error('MASTER_REPAIR_TARGET_SHA_INVALID');
  if (!sha(currentSha) || currentSha !== targetSha) throw new Error('MASTER_REPAIR_EXACT_SHA_MISMATCH');
  if (!fingerprint(fp)) throw new Error('MASTER_REPAIR_FAILURE_FINGERPRINT_INVALID');
  if (!String(runId).trim()) throw new Error('MASTER_REPAIR_RUN_ID_REQUIRED');

  const failureLog = readText(failureLogPath);
  const diagnosis = readJson(diagnosisPath);
  const scout = readJson(scoutPath);
  const strategy = readJson(strategyPath);
  const rootProof = readJson(rootProofPath);
  const rcaManifest = readJson(rcaManifestPath);
  const historicalLearning = readJson(historicalLearningPath);
  const teaching = readJson(teachingPath);
  const memory = readJson(memoryPath) ?? { cases: [], lessons: [], antiLessons: [], actionHistory: [] };

  const rows = observedEvidence({
    targetSha, runId: String(runId), fp,
    failureLog, diagnosis, scout, strategy, rootProof, rcaManifest,
    historicalLearning, teaching,
  });
  const evidence = checkEvidence(rows, targetSha);

  const deep = buildDeepInference({
    executionSha: targetSha,
    observed: rows,
    historicalSignals: {
      memoryLessons: memory.lessons ?? [],
      knownRootCauses: (memory.cases ?? []).map((x) => x.rootCause).filter(Boolean),
    },
    securityFindings: [],
    recurringPatterns: [],
    downstreamFailures: rows.filter((x) => x.classification === 'DOWNSTREAM_FAILURE'),
    staleEvidence: evidence.shaMismatches,
    fullRepairIntelligence: true,
  });

  process.env.FLIXO_REPAIR_MEMORY = memoryPath;
  const knowledge = buildFusion({
    failureLog,
    diagnosis: diagnosis ?? {},
    targetSha,
    failedRunId: String(runId),
    prediction: null,
  });

  const teachingPacket = teaching ?? buildTeachingPacket({
    targetSha,
    currentSha,
    fingerprint: fp,
    memory,
    runId: String(runId),
  });

  const hypotheses = buildHypotheses({ rcaManifest, deep });
  const counterexamples = buildCounterexampleChecks({ strategy, rootProof, deep, targetSha });

  const exactIdentity =
    sha(targetSha) &&
    sha(currentSha) &&
    targetSha === currentSha &&
    String(strategy?.targetSha ?? targetSha) === targetSha &&
    String(rootProof?.targetSha ?? targetSha) === targetSha;

  const rcaReady =
    rcaManifest?.protocol === 'FLIXO-IN-REPO-REPAIR-V2' &&
    rcaManifest?.target_sha === targetSha &&
    Array.isArray(rcaManifest?.root_cause_analysis?.alternative_hypotheses) &&
    rcaManifest.root_cause_analysis.alternative_hypotheses.length >= 3 &&
    rcaManifest?.proposed_fix?.isolation_level === 'SURGICAL_PATCH' &&
    Number(rcaManifest?.proposed_fix?.scope?.max_source_files ?? 0) <= 1 &&
    rcaManifest?.evidence?.exact_sha === true;

  const proofReady =
    rootProof?.protocol === 'CAUSAL-EVIDENCE-GRAPH-v1' &&
    rootProof?.status === 'PROVEN' &&
    rootProof?.targetSha === targetSha &&
    rootProof?.failureFingerprint === fp &&
    rootProof?.sourceMutationAllowed === false;

  const strategyReady =
    Boolean(strategy?.strategyId) &&
    strategy?.targetSha === targetSha &&
    strategy?.proofObligations != null &&
    strategy?.exitCriteria === 'verified-repair-on-exact-target-sha-and-canonical-green';

  const knowledgeSafe =
    knowledge?.synthesis?.proofAuthority === 'CURRENT_EXACT_SHA_CI_ONLY' &&
    knowledge?.synthesis?.needsAdversarialReview === true;

  const counterexamplePass = counterexamples.filter((x) => x.pass).length;
  const fiveXCycle = buildFiveXRepairCycleState({
    phase: 'MASTER_GATE',
    chainId: 'MASTER:' + runId + ':' + fp,
    taskId: 'MASTER-REPAIR:' + runId + ':' + fp,
    failureFingerprint: fp,
    attempt: Number(process.env.FLIXO_REPAIR_ATTEMPT ?? 1),
    targetSha,
    currentSha,
    failedSha: targetSha,
    strategyId: strategy?.strategyId ?? null,
    adversarialStatus: counterexamplePass >= 10 ? 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' : 'MASTER_FALSIFICATION_INCOMPLETE',
    counterexampleFound: counterexamplePass < 10,
    regressionOk: null,
    regressionDepth: 0,
    learningOutputs: 8,
    canonicalGreen: false,
  });

  const blockers = [];
  if (!exactIdentity) blockers.push('IDENTITY_NOT_BOUND_TO_EXACT_SHA');
  if (evidence.missingSources.length) blockers.push('EVIDENCE_SOURCES_MISSING:' + evidence.missingSources.join(','));
  if (evidence.shaMismatches.length) blockers.push('STALE_EVIDENCE:' + evidence.shaMismatches.join(','));
  if (!failureLog.trim()) blockers.push('FAILURE_LOG_MISSING');
  if (!diagnosis) blockers.push('DIAGNOSIS_MISSING');
  if (!scout) blockers.push('SCOUT_MISSING');
  if (!proofReady) blockers.push('ROOT_CAUSE_PROOF_NOT_PROVEN');
  if (!rcaReady) blockers.push('RCA_MANIFEST_NOT_READY');
  if (!strategyReady) blockers.push('REPAIR_STRATEGY_NOT_BOUND');
  if (hypotheses.length < 6) blockers.push('MASTER_REQUIRES_SIX_OR_MORE_HYPOTHESES');
  if (counterexamplePass < 10) blockers.push('MASTER_REQUIRES_TEN_PASSED_FALSIFICATION_CHECKS');
  if (deep?.synthesis?.status === 'UNKNOWN_RCA') blockers.push('DEEP_REASONING_UNKNOWN_RCA');
  if (!knowledgeSafe) blockers.push('KNOWLEDGE_ARBITRATION_NOT_SAFE');

  const status = blockers.length === 0 ? 'MASTER_REPAIR_READY' : 'MASTER_ESCALATION_REQUIRED';
  const packet = {
    protocol: 'FLIXO-MASTER-REPAIR-ORCHESTRATOR-v1',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    authority: 'READ_ONLY_MASTER_REPAIR_GATE',
    mutationAuthority: false,
    certificationAuthority: false,
    target: {
      runId: String(runId),
      failureFingerprint: fp,
      targetSha,
      currentSha,
      exactSha: exactIdentity,
      branch: 'execution',
    },
    evidence: {
      sources: evidence,
      rows,
      independentEvidenceSourceCount: Math.min(10, evidence.sourceDiversity),
      requiredEvidenceClasses: ['IDENTITY', 'CONSTRAINTS', 'CAUSALITY', 'FALSIFICATION', 'REGRESSION', 'DEPENDENCIES', 'SECURITY', 'REPRODUCIBILITY', 'COORDINATION', 'LEARNING'],
    },
    intelligence: {
      deepReasoning: deep,
      knowledgeFusion: knowledge,
      teaching: teachingPacket,
      hypotheses,
      falsification: counterexamples,
      knowledgeGraph: buildRepairKnowledgeGraph({
        fingerprint: fp,
        targetSha,
        diagnosis,
        plan: strategy,
        simulation: null,
        selfCritic: null,
        causalProof: rootProof,
      }),
      fiveXCyclePreview: fiveXCycle,
    },
    decision: {
      status,
      blockers,
      nextAction: blockers.length ? 'MASTER_CONSULT_OR_NEW_EVIDENCE_REQUIRED' : 'PROCEED_TO_EXISTING_MUTATION_GATES',
      confidence: Number(Math.min(
        1,
        (exactIdentity ? 0.2 : 0) +
        (proofReady ? 0.2 : 0) +
        (rcaReady ? 0.2 : 0) +
        (strategyReady ? 0.15 : 0) +
        (hypotheses.length >= 3 ? 0.1 : 0) +
        (counterexamplePass >= 5 ? 0.1 : 0) +
        (knowledgeSafe ? 0.05 : 0)
      ).toFixed(3)),
      closureAuthority: 'CANONICAL_GREEN_AND_CERTIFICATION_ONLY',
    },
    learning: {
      lessonCandidate: status === 'MASTER_REPAIR_READY',
      antiLessonCandidate: blockers.length > 0,
      preservePacketUntilGreen: true,
    },
  };
  return packet;
}

async function main() {
  const output = arg('output', '/tmp/flixo-master-repair-packet.json');
  const packet = await buildMasterRepairPacket();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(packet, null, 2) + '\n');
  console.log(JSON.stringify({
    status: packet.decision.status,
    targetSha: packet.target.targetSha,
    fingerprint: packet.target.failureFingerprint,
    blockerCount: packet.decision.blockers.length,
    confidence: packet.decision.confidence,
    output,
  }, null, 2));
  if (packet.decision.status !== 'MASTER_REPAIR_READY') process.exitCode = 2;
}

if (process.argv[1] && new URL('file://' + process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error('MASTER_REPAIR_ORCHESTRATOR_ERROR=' + (error?.stack ?? error));
    process.exitCode = 1;
  });
}
