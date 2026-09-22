#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { trainRepairBot } from './repair-bot-training.mjs';
import { loadMemory, fingerprintFailure, normalizeFailure } from './auto-repair-learning.mjs';

const ROOT = process.cwd();
const OUTPUT = process.env.FLIXO_REPAIR_AGENT_CLONE_OUTPUT ?? '/tmp/flixo-repair-agent-clone.json';
const FAILURE_LOG = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const DIAGNOSIS = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';
const EXPECTED_SHA = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? '').trim();
const RUN_ID = String(process.env.TARGET_RUN_ID ?? '').trim();

export const COGNITIVE_CAPABILITIES = Object.freeze([
  'ROOT_CAUSE_IDENTIFICATION',
  'EVIDENCE_DRIVEN_ACTION_SELECTION',
  'SUCCESS_AND_FAILURE_LEARNING',
  'ANTI_LESSON_AVOIDANCE',
  'BEHAVIORAL_SEQUENCE_LEARNING',
  'STATE_ACTION_LEARNING',
  'FEEDBACK_REWARD_LEARNING',
  'COUNTERFACTUAL_AVOIDANCE',
  'EXTERNAL_FAILURE_SEPARATION',
  'FRESH_EXACT_SHA_VERIFICATION',
  'PRIORITIZED_EXPERIENCE_REPLAY',
  'CONFIDENCE_CALIBRATION',
  'ABSTENTION',
  'RECURRENCE_PREDICTION',
  'ANTI_CATASTROPHIC_FORGETTING',
  'SKILL_SPECIFIC_MASTERY',
  'HELD_OUT_GOLDEN_BENCHMARK',
  'CONTINUOUS_EXPERIENCE_LEDGER',
  'POLICY_PROMOTION_GATE',
  'POLICY_ROLLBACK',
  'REPLAYABLE_DECISION_PROVENANCE',
  'EARLY_RECURRENCE_WARNING',
  'HELD_OUT_SKILL_MASTERY',
]);

const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const readJson = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const branch = git('branch', '--show-current');
if (branch !== 'execution') throw new Error('REPAIR_AGENT_CLONE_EXECUTION_BRANCH_REQUIRED');
const currentSha = git('rev-parse', 'HEAD');
if (!/^[a-f0-9]{40}$/u.test(currentSha)) throw new Error('REPAIR_AGENT_CLONE_SHA_INVALID');
if (EXPECTED_SHA && EXPECTED_SHA !== currentSha) {
  throw new Error(`REPAIR_AGENT_CLONE_EXACT_SHA_MISMATCH:${currentSha}:${EXPECTED_SHA}`);
}
if (!fs.existsSync(FAILURE_LOG)) throw new Error('REPAIR_AGENT_CLONE_FAILURE_EVIDENCE_MISSING');
const log = fs.readFileSync(FAILURE_LOG, 'utf8');
if (!log.trim()) throw new Error('REPAIR_AGENT_CLONE_FAILURE_EVIDENCE_EMPTY');

const memory = loadMemory();
const diagnosis = readJson(DIAGNOSIS, {});
const training = trainRepairBot({ memory, log, diagnosis });
const trainingSource = fs.readFileSync(path.join(ROOT, 'scripts/ci/repair-bot-training.mjs'), 'utf8');
const sourceDigest = sha256(trainingSource);
const fingerprint = fingerprintFailure(log);
const normalizedFailure = normalizeFailure(log);
const trainingObjectives = Array.isArray(training.trainingObjectives) ? training.trainingObjectives : [];
const missingCapabilities = COGNITIVE_CAPABILITIES.filter((capability) => !trainingObjectives.includes(capability));
if (missingCapabilities.length) {
  throw new Error(`REPAIR_AGENT_CLONE_COGNITIVE_PARITY_INCOMPLETE:${missingCapabilities.join(',')}`);
}

const rootCause = String(training.currentRootCause ?? diagnosis.rootCause ?? 'unknown').trim().toLowerCase();
const ranked = Array.isArray(training.activePolicy?.byRootCause?.[rootCause]) ? training.activePolicy.byRootCause[rootCause] : [];
const rankedAlternative = ranked.find((candidate) => candidate.strategyId !== training.preferredStrategy?.strategyId)?.strategyId ?? null;
const globalAlternatives = Object.keys(training.policy?.global ?? {}).filter((strategyId) => strategyId !== training.preferredStrategy?.strategyId);
const alternativeStrategy = rankedAlternative ?? globalAlternatives[0] ?? null;

const cloneReport = {
  schemaVersion: 1,
  protocol: 'FLIXO-REPAIR-AGENT-COGNITIVE-CLONE-v1',
  identity: 'repairAgentClone',
  role: 'INDEPENDENT_COGNITIVE_REPAIR_PEER',
  authority: 'COGNITIVE_PARITY_WITH_SEPARATED_AUTHORITY',
  mutationAuthority: false,
  repositoryWrite: false,
  greenAuthority: false,
  certificationAuthority: false,
  exactShaBound: true,
  targetSha: currentSha,
  expectedSha: EXPECTED_SHA || currentSha,
  targetRunId: RUN_ID || null,
  failureFingerprint: fingerprint,
  normalizedFailure,
  sameCognitiveEngine: true,
  cognitiveParity: {
    level: 'EXACT',
    sourceModule: 'scripts/ci/repair-bot-training.mjs',
    sourceDigest,
    capabilityCount: COGNITIVE_CAPABILITIES.length,
    capabilities: [...COGNITIVE_CAPABILITIES],
    missingCapabilities,
    sharedAlgorithms: [
      'VERIFIED_EXPERIENCE_LEDGER-v1',
      'TABULAR_STATE_ACTION_Q',
      'ADVERSARIAL_CONTEXT_REPLAY',
      'EVIDENCE_BACKED_COUNTERFACTUAL_REJECTION',
      'DETERMINISTIC_PRIORITY_REPLAY-v1',
      'POLICY_LIFECYCLE_GUARD-v1',
      'HELD_OUT_SKILL_MASTERY-v1',
    ],
  },
  learning: {
    mode: 'INDEPENDENT_REPLAY_FROM_SHARED_EVIDENCE',
    trainingProtocol: training.protocol,
    trainingDigest: sha256(JSON.stringify(training)),
    sourceMemoryVersion: memory?.version ?? null,
    negativeLearningConsumed: Array.isArray(memory?.antiLessons),
    isolatedPromotion: true,
    promotionRule: 'ONLY_AFTER_CANONICAL_GREEN',
    primaryMemoryWrite: false,
  },
  adversarialPeer: {
    enabled: true,
    objective: 'CHALLENGE_PRIMARY_REPAIR_SELECTION',
    primaryStrategy: training.preferredStrategy?.strategyId ?? ranked[0]?.strategyId ?? null,
    alternativeStrategy,
    dissent: alternativeStrategy !== null && alternativeStrategy !== (training.preferredStrategy?.strategyId ?? null),
    mutation: false,
    greenOverride: false,
    recommendation: alternativeStrategy ? 'COUNTERCHECK_PRIMARY' : 'NO_SAFE_ALTERNATIVE_FOUND',
  },
  deduction: {
    rootCause,
    preferredStrategy: training.preferredStrategy?.strategyId ?? ranked[0]?.strategyId ?? null,
    alternativeStrategy,
    recurrenceEvaluation: training.recurrenceEarlyWarning?.evaluation ?? null,
    calibration: {
      algorithm: training.calibration?.algorithm ?? null,
      expectedCalibrationError: training.calibration?.expectedCalibrationError ?? null,
      recommendedAbstentionThreshold: training.calibration?.abstention?.recommendedThreshold ?? null,
    },
    policyLifecycle: {
      status: training.policyLifecycle?.status ?? null,
      rollbackRequired: training.policyLifecycle?.rollbackRequired ?? false,
      routingEligible: training.policyLifecycle?.routingEligible ?? false,
      candidatePolicyHash: training.policyLifecycle?.candidatePolicyHash ?? null,
      activePolicyHash: training.policyLifecycle?.activePolicyHash ?? null,
      activePolicySource: training.policyLifecycle?.activePolicySource ?? null,
    },
  },
  decision: {
    mode: training.decision?.mode ?? 'CURRICULUM_ONLY',
    competent: training.decision?.competent === true,
    sufficient: training.decision?.sufficient === true,
    eligibleToInfluenceRouting: training.decision?.eligibleToInfluenceRouting === true,
  },
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(cloneReport, null, 2) + '\n');
console.log(JSON.stringify(cloneReport, null, 2));
