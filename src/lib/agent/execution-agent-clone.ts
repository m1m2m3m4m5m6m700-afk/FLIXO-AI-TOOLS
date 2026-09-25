import type { ExecutionPlan } from '@/lib/ai/planner';
import { assessCognitiveRequest, decideRecovery, type CognitiveAssessment, type RecoveryDecision } from './cognitive-orchestrator';
import { cancelPreparedExecution, confirmPreparedExecution, executePreparedExecution, prepareExecution, type ExecutionIntegrationResult, type PreparedExecution } from './execution-integrator';
import { buildAgentOutcome, type AgentOutcome } from './cognitive-outcome';
import type { PipelineProgress } from '@/lib/workflows/pipeline-runner';

export const EXECUTION_AGENT_CLONE_ID = 'execution-agent-clone-v1' as const;
export type ExecutionAgentCloneIdentity = Readonly<{
  cloneId: typeof EXECUTION_AGENT_CLONE_ID;
  baseRole: 'executionAgent';
  authority: 'DELEGATED_CANONICAL_EXECUTION';
  executorAuthority: 'PIPELINE_RUNNER_ONLY';
  registryAuthority: 'CANONICAL_REGISTRY_ONLY';
  gateAuthority: 'CANONICAL_EXECUTION_GATE';
}>;

export const EXECUTION_AGENT_CLONE_IDENTITY: ExecutionAgentCloneIdentity = Object.freeze({
  cloneId: EXECUTION_AGENT_CLONE_ID,
  baseRole: 'executionAgent',
  authority: 'DELEGATED_CANONICAL_EXECUTION',
  executorAuthority: 'PIPELINE_RUNNER_ONLY',
  registryAuthority: 'CANONICAL_REGISTRY_ONLY',
  gateAuthority: 'CANONICAL_EXECUTION_GATE',
});

export type ExecutionAgentCloneSession = Readonly<{
  identity: ExecutionAgentCloneIdentity;
  taskId: string;
  traceId: string;
  request: string;
  assessment: CognitiveAssessment;
  prepared: PreparedExecution | null;
}>;

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function assertIdentity(value: string, label: string): void {
  if (!value.trim() || value.length > 256 || hasControlCharacter(value)) {
    throw new Error('EXECUTION_AGENT_CLONE_' + label.toUpperCase() + '_INVALID');
  }
}

function buildSession(request: string, assessment: CognitiveAssessment, taskId?: string, traceId?: string): ExecutionAgentCloneSession {
  const resolvedTaskId = taskId ?? assessment.intentPlan.taskId ?? crypto.randomUUID();
  const resolvedTraceId = traceId ?? assessment.intentPlan.traceId ?? crypto.randomUUID();
  assertIdentity(resolvedTaskId, 'TASK_ID');
  assertIdentity(resolvedTraceId, 'TRACE_ID');
  const prepared = assessment.executionPlan
    ? prepareExecution(assessment.executionPlan, { taskId: resolvedTaskId, traceId: resolvedTraceId })
    : null;
  return Object.freeze({
    identity: EXECUTION_AGENT_CLONE_IDENTITY,
    taskId: resolvedTaskId,
    traceId: resolvedTraceId,
    request,
    assessment,
    prepared,
  });
}

export function createExecutionAgentCloneSession(request: string, identity: Readonly<{ taskId?: string; traceId?: string }> = {}): ExecutionAgentCloneSession {
  const normalized = request.trim();
  if (!normalized) throw new Error('EXECUTION_AGENT_CLONE_REQUEST_REQUIRED');
  const assessment = assessCognitiveRequest(normalized, identity);
  return buildSession(normalized, assessment, identity.taskId, identity.traceId);
}

export function refreshExecutionAgentCloneSession(session: ExecutionAgentCloneSession): ExecutionAgentCloneSession {
  return createExecutionAgentCloneSession(session.request, { taskId: session.taskId, traceId: session.traceId });
}

export function confirmExecutionAgentClone(session: ExecutionAgentCloneSession): ExecutionAgentCloneSession {
  if (!session.prepared) throw new Error('EXECUTION_AGENT_CLONE_NOT_EXECUTABLE');
  return Object.freeze({ ...session, prepared: confirmPreparedExecution(session.prepared) });
}

export function cancelExecutionAgentClone(session: ExecutionAgentCloneSession): ExecutionAgentCloneSession {
  if (!session.prepared) throw new Error('EXECUTION_AGENT_CLONE_NOT_PREPARED');
  return Object.freeze({ ...session, prepared: cancelPreparedExecution(session.prepared) });
}

export async function executeExecutionAgentClone(session: ExecutionAgentCloneSession, inputFile: File, onProgress: (progress: PipelineProgress) => void): Promise<ExecutionIntegrationResult> {
  if (!session.prepared) throw new Error('EXECUTION_AGENT_CLONE_NOT_PREPARED');
  return executePreparedExecution(session.prepared, inputFile, onProgress);
}

export function recoverExecutionAgentClone(session: ExecutionAgentCloneSession, errorClass: string, attemptsUsed: number): RecoveryDecision {
  const capabilityId = session.assessment.executionPlan?.steps[0]?.toolId;
  if (!capabilityId) return Object.freeze({
    action: 'FAIL_CLOSED',
    recovery: Object.freeze({ maxAttempts: 0, replanOnFailure: false, retryAllowed: false, recoveryMode: 'FAIL_CLOSED' }),
    reason: 'NO_EXECUTABLE_CAPABILITY',
  });
  return decideRecovery(capabilityId, errorClass, attemptsUsed);
}

export function buildExecutionAgentCloneOutcome(input: {
  missionId: string;
  botId?: string;
  exactSha: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED_EXTERNAL' | 'BLOCKED_INTERNAL' | 'PROPOSED' | 'REVERTED';
  capabilityId?: string;
  verified: boolean;
  validationPassed: boolean;
  evidenceRefs: readonly string[];
  error?: unknown;
  reverted?: boolean;
  contradictions?: number;
}): AgentOutcome {
  return buildAgentOutcome({
    missionId: input.missionId,
    taskId: input.missionId,
    botId: input.botId ?? EXECUTION_AGENT_CLONE_ID,
    exactSha: input.exactSha,
    outcome: input.outcome,
    capabilityId: input.capabilityId ?? 'execution-agent-clone',
    inputDescription: input.capabilityId ?? 'execution-agent-clone',
    verified: input.verified,
    validationPassed: input.validationPassed,
    reverted: input.reverted,
    contradictions: input.contradictions,
    evidenceRefs: input.evidenceRefs,
    error: input.error,
  });
}

export function executionPlanForClone(session: ExecutionAgentCloneSession): ExecutionPlan | null {
  return session.assessment.executionPlan;
}

export function cloneDecision(session: ExecutionAgentCloneSession): CognitiveAssessment['decision'] {
  return session.assessment.decision;
}
