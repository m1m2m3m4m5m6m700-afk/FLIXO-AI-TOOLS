import {
  approveRun,
  applyNextStep,
  cancelRun,
  failRun,
  recordToolCall,
  recordToolResult,
  restoreFlixoBotRunState,
  type FlixoBotAuthority,
  type FlixoBotRunState,
  type FlixoBotToolEvidence,
} from './flixo-bot-openai-runtime';
import type { TaskContext, TaskState } from './task-state';
import { requireFlixoBuildSha } from './build-identity';
import {
  appendConversationEvent,
  loadConversationEvents,
  verifyConversationEventChain,
  type ConversationEvent,
} from './conversation-event-store';

export type FlixoBotExecutionTaskSnapshot = Readonly<{
  runtime: FlixoBotRunState;
  task: TaskContext;
}>;

export const RUNTIME_EXECUTION_AUTHORITY: FlixoBotAuthority = Object.freeze({
  mutationAuthority: false,
  certificationAuthority: false,
});


let approvalTransactionChain: Promise<unknown> = Promise.resolve();

export function assertApprovalNotReplayed(
  events: readonly ConversationEvent[],
  runId: string,
  approvalId: string,
): void {
  const replayed = events.some((event) => {
    if (event.kind !== 'SYSTEM') return false;
    const payload = event.payload;
    return payload.type === 'FLIXO_BOT_APPROVAL_ACCEPTED'
      && payload.runId === runId
      && payload.approvalId === approvalId;
  });
  if (replayed) throw new Error('FLIXO_BOT_APPROVAL_REPLAY');
}


export function runtimeStatusToTaskState(status: FlixoBotRunState['status']): TaskState {
  if (status === 'WAITING_APPROVAL') return 'AWAITING_CONFIRMATION';
  if (status === 'RUNNING' || status === 'RETRYING') return 'EXECUTING';
  if (status === 'SUCCEEDED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'FAILED' || status === 'BLOCKED' || status === 'STALE') return 'FAILED';
  return 'PLANNED';
}

export function assertRuntimeTaskIdentity(
  runtime: FlixoBotRunState,
  task: TaskContext,
): void {
  if (runtime.taskId !== task.taskId) throw new Error('FLIXO_BOT_RUNTIME_TASK_ID_MISMATCH');
  if (runtime.traceId !== task.traceId) throw new Error('FLIXO_BOT_RUNTIME_TRACE_ID_MISMATCH');
  if (runtime.branch !== 'execution') throw new Error('FLIXO_BOT_RUNTIME_NON_CANONICAL_BRANCH');
}

export function restoreRuntimeForExecution(
  serialized: string,
  task: TaskContext,
): FlixoBotExecutionTaskSnapshot {
  const currentSha = requireFlixoBuildSha();
  const runtime = restoreFlixoBotRunState(serialized, currentSha);
  assertRuntimeTaskIdentity(runtime, task);
  const expected = runtimeStatusToTaskState(runtime.status);
  if (task.state !== expected && !(runtime.status === 'RUNNING' && task.state === 'EXECUTING')) {
    throw new Error('FLIXO_BOT_RUNTIME_TASK_STATE_MISMATCH');
  }
  return Object.freeze({ runtime, task });
}

export async function confirmRuntimeExecution(
  runtime: FlixoBotRunState,
  task: TaskContext,
): Promise<FlixoBotExecutionTaskSnapshot> {
  const transaction = approvalTransactionChain.then(async () => {
    const currentSha = requireFlixoBuildSha();
    assertRuntimeTaskIdentity(runtime, task);
    const approvalId = runtime.pendingApproval?.approvalId;
    if (!approvalId) throw new Error('FLIXO_BOT_APPROVAL_ID_MISSING');

    const events = loadConversationEvents();
    if (!(await verifyConversationEventChain(events))) {
      throw new Error('FLIXO_BOT_APPROVAL_LEDGER_INVALID');
    }
    assertApprovalNotReplayed(events, runtime.runId, approvalId);

    const nextRuntime = approveRun(runtime, currentSha, approvalId);
    if (runtimeStatusToTaskState(nextRuntime.status) !== 'EXECUTING') {
      throw new Error('FLIXO_BOT_RUNTIME_APPROVAL_DID_NOT_ENTER_EXECUTION');
    }

    const accepted = await appendConversationEvent('SYSTEM', {
      type: 'FLIXO_BOT_APPROVAL_ACCEPTED',
      runId: runtime.runId,
      taskId: runtime.taskId,
      approvalId,
      exactSha: currentSha,
    });
    const persisted = loadConversationEvents().some((event) => event.eventId === accepted.eventId);
    if (!persisted) throw new Error('FLIXO_BOT_APPROVAL_PERSISTENCE_FAILED');

    return Object.freeze({ runtime: nextRuntime, task });
  });
  approvalTransactionChain = transaction.catch(() => undefined);
  return transaction;
}

export function beforeRuntimeTool(
  runtime: FlixoBotRunState,
  task: TaskContext,
  toolId: string,
  callId: string,
): FlixoBotRunState {
  const currentSha = requireFlixoBuildSha();
  assertRuntimeTaskIdentity(runtime, task);
  const { state, decision } = recordToolCall(runtime, currentSha, {
    toolId,
    callId,
    actorId: runtime.currentOwner,
    branch: runtime.branch,
    exactSha: runtime.exactSha,
    expectedSha: currentSha,
    mutation: false,
    certification: false,
    requiresApproval: false,
  }, RUNTIME_EXECUTION_AUTHORITY);
  if (!decision.allowed) throw new Error('FLIXO_BOT_RUNTIME_TOOL_BLOCKED=' + decision.reason);
  return state;
}

export function afterRuntimeTool(
  runtime: FlixoBotRunState,
  task: TaskContext,
  toolId: string,
  success: boolean,
  output: unknown,
  evidence: FlixoBotToolEvidence = {},
): FlixoBotRunState {
  const currentSha = requireFlixoBuildSha();
  assertRuntimeTaskIdentity(runtime, task);
  return recordToolResult(runtime, currentSha, runtime.currentOwner, toolId, success, output, evidence);
}


export function completeRuntimeExecution(
  runtime: FlixoBotRunState,
  task: TaskContext,
  result: Readonly<{ byteLength: number; mimeType: string }>,
): FlixoBotRunState {
  const currentSha = requireFlixoBuildSha();
  assertRuntimeTaskIdentity(runtime, task);
  return applyNextStep(runtime, currentSha, {
    type: 'FINAL',
    output: {
      byteLength: result.byteLength,
      mimeType: result.mimeType,
    },
  });
}

export function failRuntimeExecution(
  runtime: FlixoBotRunState,
  task: TaskContext,
  reason: string,
): FlixoBotRunState {
  const currentSha = requireFlixoBuildSha();
  assertRuntimeTaskIdentity(runtime, task);
  return failRun(runtime, currentSha, reason);
}

export function cancelRuntimeExecution(
  runtime: FlixoBotRunState,
  task: TaskContext,
  reason: string,
): FlixoBotRunState {
  const currentSha = requireFlixoBuildSha();
  assertRuntimeTaskIdentity(runtime, task);
  return cancelRun(runtime, currentSha, reason);
}
