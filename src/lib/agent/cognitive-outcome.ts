import { classifyExecutionFailure, type ExecutionAuditEvent } from '@/lib/agent/execution-observability';
import { fingerprintFailure, learningDecision, type LearningDecision, type MissionResultContract, type MissionOutcome } from '@/lib/agent/swarm/learning-memory-routing';

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
  errorClass: MissionResultContract['outcome'] extends 'FAILURE' ? ReturnType<typeof classifyExecutionFailure> : ReturnType<typeof classifyExecutionFailure> | null;
}>;

export function buildAgentOutcome(input: AgentOutcomeInput): AgentOutcome {
  const isFailure = input.outcome === 'FAILURE' || input.error !== undefined;
  const failureFingerprint = isFailure
    ? fingerprintFailure({
      category: classifyExecutionFailure(input.error ?? 'execution failure') ?? 'EXECUTION',
      normalizedMessage: input.error instanceof Error ? input.error.message : String(input.error ?? 'execution failure'),
      violatedInvariant: input.error instanceof Error ? input.error.name : 'FLIXO_EXECUTION_INVARIANT',
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
    rootCause: isFailure ? (input.error instanceof Error ? input.error.name : 'UNKNOWN') : null,
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
    errorClass: input.error === undefined ? null : classifyExecutionFailure(input.error),
  });
}
