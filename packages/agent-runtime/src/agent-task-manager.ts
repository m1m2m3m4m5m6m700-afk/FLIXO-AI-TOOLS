import {
  createTaskContext,
  transitionTask,
  type TaskContext,
  type TaskState,
} from './task-state.ts';

export type AgentTaskLifecycle =
  | 'QUEUED'
  | 'PLANNED'
  | 'AWAITING_CONFIRMATION'
  | 'RUNNING'
  | 'VERIFYING'
  | 'RECOVERING'
  | 'RESUMED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AgentTaskRecord = Readonly<{
  taskId: string;
  traceId: string;
  ownerId: string;
  lifecycle: AgentTaskLifecycle;
  context: TaskContext;
  resumeCount: number;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateAgentTaskInput = Readonly<{
  taskId: string;
  traceId?: string;
  ownerId: string;
}>;

const lifecycleForState = (state: TaskState): AgentTaskLifecycle => {
  switch (state) {
    case 'IDLE':
    case 'NEEDS_INPUT':
      return 'QUEUED';
    case 'PLANNED':
      return 'PLANNED';
    case 'AWAITING_CONFIRMATION':
      return 'AWAITING_CONFIRMATION';
    case 'EXECUTING':
      return 'RUNNING';
    case 'VERIFYING':
      return 'VERIFYING';
    case 'RECOVERING':
      return 'RECOVERING';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
  }
};

function assertInput(input: CreateAgentTaskInput): void {
  if (!input.taskId.trim()) throw new Error('AGENT_TASK_ID_REQUIRED');
  if (!input.ownerId.trim()) throw new Error('AGENT_TASK_OWNER_REQUIRED');
  if (input.traceId !== undefined && !input.traceId.trim()) {
    throw new Error('AGENT_TASK_TRACE_ID_REQUIRED');
  }
}

export function createAgentTaskRecord(input: CreateAgentTaskInput): AgentTaskRecord {
  assertInput(input);
  const context = createTaskContext(input.taskId, input.traceId);
  const now = new Date().toISOString();
  return Object.freeze({
    taskId: input.taskId,
    traceId: context.traceId,
    ownerId: input.ownerId,
    lifecycle: 'QUEUED',
    context,
    resumeCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export function transitionAgentTask(
  record: AgentTaskRecord,
  nextState: TaskState,
): AgentTaskRecord {
  const context = transitionTask(record.context, nextState);
  return Object.freeze({
    ...record,
    context,
    lifecycle: lifecycleForState(nextState),
    updatedAt: new Date().toISOString(),
  });
}

export function resumeAgentTask(record: AgentTaskRecord): AgentTaskRecord {
  if (record.lifecycle !== 'RECOVERING' || record.context.state !== 'RECOVERING') {
    throw new Error(`AGENT_TASK_RESUME_REQUIRES_RECOVERING=${record.taskId}`);
  }
  const context = transitionTask(record.context, 'PLANNED');
  return Object.freeze({
    ...record,
    context,
    lifecycle: 'RESUMED',
    resumeCount: record.resumeCount + 1,
    updatedAt: new Date().toISOString(),
  });
}

export class AgentTaskManager {
  private readonly records = new Map<string, AgentTaskRecord>();

  create(input: CreateAgentTaskInput): AgentTaskRecord {
    if (this.records.has(input.taskId)) {
      throw new Error(`AGENT_TASK_ID_COLLISION=${input.taskId}`);
    }
    const record = createAgentTaskRecord(input);
    this.records.set(record.taskId, record);
    return record;
  }

  get(taskId: string): AgentTaskRecord | undefined {
    return this.records.get(taskId);
  }

  transition(taskId: string, nextState: TaskState): AgentTaskRecord {
    const current = this.records.get(taskId);
    if (!current) throw new Error(`AGENT_TASK_NOT_FOUND=${taskId}`);
    const next = transitionAgentTask(current, nextState);
    this.records.set(taskId, next);
    return next;
  }

  resume(taskId: string): AgentTaskRecord {
    const current = this.records.get(taskId);
    if (!current) throw new Error(`AGENT_TASK_NOT_FOUND=${taskId}`);
    const next = resumeAgentTask(current);
    this.records.set(taskId, next);
    return next;
  }

  list(): readonly AgentTaskRecord[] {
    return Object.freeze([...this.records.values()]);
  }
}
