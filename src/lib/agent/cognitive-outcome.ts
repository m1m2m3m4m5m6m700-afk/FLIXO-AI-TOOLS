import {
  classifyExecutionFailure,
  type ExecutionAuditEvent,
} from '@/lib/agent/execution-observability';
import { createHash } from 'node:crypto';

export type MissionOutcome =
  | 'SUCCESS'
  | 'FAILURE'
  | 'BLOCKED_EXTERNAL'
  | 'BLOCKED_INTERNAL'
  | 'PROPOSED'
  | 'REVERTED';

export type LearningDecision =
  | 'PROVISIONAL_LESSON'
  | 'VERIFIED_KNOWLEDGE'
  | 'ANTI_LESSON'
  | 'BLOCKED_EXTERNAL'
  | 'BLOCKED_INTERNAL'
  | 'NO_CONFIDENCE_CHANGE'
  | 'STRATEGY_REJECTED';

export type MissionResultContract = Readonly<{
  missionId: string;
  taskId: string;
  botId: string;
  exactSha: string;
  outcome: MissionOutcome;
  strategyId: string | null;
  failureFingerprint: string | null;
  rootCause: string | null;
  evidenceRefs: readonly string[];
  verified: boolean;
  reverted: boolean;
}>;

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase()
    .replace(/\s+/gu, ' ')
    .replace(/[^\p{L}\p{N}_:./ -]/gu, '')
    .trim();
}

function fingerprintFailure(input: {
  category: string;
  normalizedMessage: string;
  violatedInvariant: string;
  causalSource: string;
  affectedScope: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        category: normalize(input.category),
        normalizedMessage: normalize(input.normalizedMessage),
        violatedInvariant: normalize(input.violatedInvariant),
        causalSource: normalize(input.causalSource),
        affectedScope: normalize(input.affectedScope),
      }),
      'utf8',
    )
    .digest('hex');
}

function validateMissionResult(input: MissionResultContract): true {
  if (
    !input.missionId ||
    !input.taskId ||
    !input.botId ||
    !SHA40.test(input.exactSha)
  ) {
    throw new Error('MISSION_RESULT_IDENTITY_INVALID');
  }

  if (!input.evidenceRefs.length) {
    throw new Error('MISSION_RESULT_EVIDENCE_REQUIRED');
  }

  if (
    !['SUCCESS', 'FAILURE', 'BLOCKED_EXTERNAL', 'BLOCKED_INTERNAL', 'PROPOSED', 'REVERTED'].includes(
      input.outcome,
    )
  ) {
    throw new Error('MISSION_RESULT_OUTCOME_INVALID');
  }

  if (
    !['FAILURE', 'BLOCKED_INTERNAL', 'BLOCKED_EXTERNAL'].includes(input.outcome) &&
    input.failureFingerprint !== null
  ) {
    throw new Error('MISSION_RESULT_FAILURE_METADATA_INVALID');
  }

  if (
    input.outcome === 'FAILURE' &&
    !SHA256.test(String(input.failureFingerprint ?? ''))
  ) {
    throw new Error('MISSION_RESULT_FINGERPRINT_REQUIRED');
  }

  return true;
}

function learningDecision(
  input: MissionResultContract & {
    validationPassed: boolean;
    currentSha: string;
    contradictions: number;
  },
): LearningDecision {
  validateMissionResult(input);

  if (input.outcome === 'PROPOSED') return 'NO_CONFIDENCE_CHANGE';
  if (input.outcome === 'REVERTED' || input.reverted) return 'STRATEGY_REJECTED';
  if (input.outcome === 'BLOCKED_EXTERNAL') return 'BLOCKED_EXTERNAL';
  if (input.outcome === 'BLOCKED_INTERNAL') return 'BLOCKED_INTERNAL';
  if (input.outcome === 'FAILURE') return 'ANTI_LESSON';

  if (
    !input.validationPassed ||
    !input.verified ||
    input.currentSha !== input.exactSha ||
    input.contradictions > 0
  ) {
    return 'PROVISIONAL_LESSON';
  }

  return 'VERIFIED_KNOWLEDGE';
}

export type AgentOutcomeInput = Readonly<{
  missionId: string;
  taskId: string;
  botId: string;
  exactSha: string;
  outcome: MissionOutcome;
  capabilityId: string;
  inputDescription: string;
  verified: boolean;
  validationPassed: boolean;
  reverted?: boolean;
  contradictions?: number;
  evidenceRefs: readonly string[];
  error?: unknown;
  auditEvents?: readonly ExecutionAuditEvent[];
}>;

export type AgentOutcome = Readonly<{
  mission: MissionResultContract;
  failureFingerprint: string | null;
  learning: LearningDecision;
  errorClass: ReturnType<typeof classifyExecutionFailure> | null;
}>;

export function buildAgentOutcome(input: AgentOutcomeInput): AgentOutcome {
  const isFailure = input.outcome === 'FAILURE' || input.error !== undefined;
  const failureFingerprint = isFailure
    ? fingerprintFailure({
        category:
          classifyExecutionFailure(input.error ?? 'execution failure') ?? 'EXECUTION',
        normalizedMessage:
          input.error instanceof Error
            ? input.error.message
            : String(input.error ?? 'execution failure'),
        violatedInvariant:
          input.error instanceof Error
            ? input.error.name
            : 'FLIXO_EXECUTION_INVARIANT',
        causalSource: input.capabilityId,
        affectedScope: input.inputDescription,
      })
    : null;

  const mission: MissionResultContract = {
    missionId: input.missionId,
    taskId: input.taskId,
    botId: input.botId,
    exactSha: input.exactSha,
    outcome: input.outcome,
    strategyId: input.capabilityId,
    failureFingerprint,
    rootCause: isFailure
      ? input.error instanceof Error
        ? input.error.name
        : 'UNKNOWN'
      : null,
    evidenceRefs: [...input.evidenceRefs],
    verified: input.verified,
    reverted: input.reverted ?? false,
  };

  const learning = learningDecision({
    ...mission,
    validationPassed: input.validationPassed,
    currentSha: input.exactSha,
    contradictions: input.contradictions ?? 0,
  });

  return Object.freeze({
    mission,
    failureFingerprint,
    learning,
    errorClass:
      input.error === undefined ? null : classifyExecutionFailure(input.error),
  });
}
