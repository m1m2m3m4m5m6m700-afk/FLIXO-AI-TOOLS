export const TASK_STATES = [
  'IDLE',
  'NEEDS_INPUT',
  'PLANNED',
  'AWAITING_CONFIRMATION',
  'EXECUTING',
  'VERIFYING',
  'RECOVERING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export type ConfirmationDecision = 'CONFIRM' | 'CANCEL' | 'AMBIGUOUS';

export type TaskContext = Readonly<{
  taskId: string;
  traceId: string;
  state: TaskState;
  revision: number;
  confirmationRequired: boolean;
}>;

const TERMINAL_STATES: ReadonlySet<TaskState> = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

const TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  IDLE: ['NEEDS_INPUT', 'PLANNED', 'CANCELLED'],
  NEEDS_INPUT: ['NEEDS_INPUT', 'PLANNED', 'CANCELLED'],
  PLANNED: ['AWAITING_CONFIRMATION', 'NEEDS_INPUT', 'CANCELLED'],
  AWAITING_CONFIRMATION: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['VERIFYING', 'FAILED', 'CANCELLED'],
  VERIFYING: ['EXECUTING', 'COMPLETED', 'RECOVERING', 'FAILED', 'CANCELLED'],
  RECOVERING: ['PLANNED', 'AWAITING_CONFIRMATION', 'EXECUTING', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export class TaskStateTransitionError extends Error {
  readonly from: TaskState;
  readonly to: TaskState;

  constructor(from: TaskState, to: TaskState) {
    super(`Invalid task state transition: ${from} -> ${to}.`);
    this.name = 'TaskStateTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function createTaskContext(taskId: string = crypto.randomUUID(), traceId: string = crypto.randomUUID()): TaskContext {
  if (!taskId || !traceId) throw new Error('taskId and traceId are required.');
  return Object.freeze({ taskId, traceId, state: 'IDLE', revision: 0, confirmationRequired: false });
}

export function canTransition(from: TaskState, to: TaskState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionTask(context: TaskContext, next: TaskState): TaskContext {
  if (!canTransition(context.state, next)) throw new TaskStateTransitionError(context.state, next);
  return Object.freeze({
    ...context,
    state: next,
    revision: context.revision + 1,
    confirmationRequired: next === 'AWAITING_CONFIRMATION',
  });
}

export function interpretConfirmation(input: string): ConfirmationDecision {
  const normalized = input.trim().toLocaleLowerCase();
  if (!normalized) return 'AMBIGUOUS';
  if (/^(?:yes|y|confirm|confirmed|start|execute|run|go|نعم|ايوه|أيوه|موافق|تأكيد|أكد|ابدأ|ابدا|نفذ|تنفيذ|شغل|شغّل)$/.test(normalized)) return 'CONFIRM';
  if (/^(?:no|n|cancel|stop|abort|لا|إلغاء|الغاء|إلغاء الأمر|الغاء الامر|توقف|أوقف|اوقف)$/.test(normalized)) return 'CANCEL';
  return 'AMBIGUOUS';
}

export function confirmTask(context: TaskContext): TaskContext {
  if (context.state !== 'AWAITING_CONFIRMATION') {
    throw new TaskStateTransitionError(context.state, 'EXECUTING');
  }
  return transitionTask(context, 'EXECUTING');
}

export function cancelTask(context: TaskContext): TaskContext {
  if (TERMINAL_STATES.has(context.state) && context.state !== 'CANCELLED') {
    throw new TaskStateTransitionError(context.state, 'CANCELLED');
  }
  if (context.state === 'CANCELLED') return context;
  return transitionTask(context, 'CANCELLED');
}

export function assertExecutionAllowed(context: TaskContext): void {
  if (!context.taskId.trim() || !context.traceId.trim()) {
    throw new Error('Execution is blocked because task identity is missing.');
  }
  if (!Number.isInteger(context.revision) || context.revision < 0) {
    throw new Error('Execution is blocked because task revision is invalid.');
  }
  if (context.state !== 'EXECUTING' || context.confirmationRequired) {
    throw new Error(`Execution is blocked until explicit confirmation. Current state: ${context.state}.`);
  }
}

export function isTerminalTaskState(state: TaskState): boolean {
  return TERMINAL_STATES.has(state);
}
