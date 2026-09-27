export const RUNTIME_STATES = [
  "IDLE", "PLANNED", "AWAITING_CONFIRMATION", "EXECUTING",
  "VERIFYING", "COMPLETED", "FAILED", "CANCELLED",
] as const;
export type RuntimeState = (typeof RUNTIME_STATES)[number];

const TRANSITIONS: Readonly<Record<RuntimeState, readonly RuntimeState[]>> = {
  IDLE: ["PLANNED", "CANCELLED"],
  PLANNED: ["AWAITING_CONFIRMATION", "CANCELLED"],
  AWAITING_CONFIRMATION: ["EXECUTING", "CANCELLED"],
  EXECUTING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["EXECUTING", "COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [], FAILED: [], CANCELLED: [],
};

export function canTransition(from: RuntimeState, to: RuntimeState): boolean {
  return TRANSITIONS[from].includes(to);
}
export function transition(from: RuntimeState, to: RuntimeState): RuntimeState {
  if (!canTransition(from, to)) throw new Error(`Invalid runtime transition: ${from} -> ${to}`);
  return to;
}
export function isTerminal(state: RuntimeState): boolean {
  return state === "COMPLETED" || state === "FAILED" || state === "CANCELLED";
}
export function toTaskState(state: RuntimeState): TaskState {
  if (state === "PLANNED") return "PLANNED";
  if (state === "AWAITING_CONFIRMATION") return "AWAITING_CONFIRMATION";
  if (state === "EXECUTING") return "EXECUTING";
  if (state === "VERIFYING") return "VERIFYING";
  if (state === "COMPLETED") return "COMPLETED";
  if (state === "FAILED") return "FAILED";
  if (state === "CANCELLED") return "CANCELLED";
  return "IDLE";
}

/**
 * Compatibility task-state contract for application modules migrating to
 * the canonical runtime package. This is the single canonical implementation;
 * src/lib/agent/task-state.ts only re-exports it.
 */
export const TASK_STATES = [
  "IDLE", "NEEDS_INPUT", "PLANNED", "AWAITING_CONFIRMATION", "EXECUTING",
  "VERIFYING", "RECOVERING", "COMPLETED", "FAILED", "CANCELLED",
] as const;
export type ConfirmationDecision = "CONFIRM" | "CANCEL" | "AMBIGUOUS";
export type TaskContext = Readonly<{
  taskId: string;
  traceId: string;
  state: TaskState;
  revision: number;
  confirmationRequired: boolean;
}>;
const TERMINAL_TASK_STATES: ReadonlySet<TaskState> = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const TASK_TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  IDLE: ["NEEDS_INPUT", "PLANNED", "CANCELLED"],
  NEEDS_INPUT: ["NEEDS_INPUT", "PLANNED", "CANCELLED"],
  PLANNED: ["AWAITING_CONFIRMATION", "NEEDS_INPUT", "CANCELLED"],
  AWAITING_CONFIRMATION: ["EXECUTING", "CANCELLED"],
  EXECUTING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["EXECUTING", "COMPLETED", "RECOVERING", "FAILED", "CANCELLED"],
  RECOVERING: ["PLANNED", "AWAITING_CONFIRMATION", "EXECUTING", "FAILED", "CANCELLED"],
  COMPLETED: [], FAILED: [], CANCELLED: [],
};
export class TaskStateTransitionError extends Error {
  readonly from: TaskState; readonly to: TaskState;
  constructor(from: TaskState, to: TaskState) {
    super(`Invalid task state transition: ${from} -> ${to}.`);
    this.name = "TaskStateTransitionError"; this.from = from; this.to = to;
  }
}
export type TaskState = (typeof TASK_STATES)[number];

export function createTaskContext(taskId: string = crypto.randomUUID(), traceId: string = crypto.randomUUID()): TaskContext {
  if (!taskId || !traceId) throw new Error("taskId and traceId are required.");
  return Object.freeze({ taskId, traceId, state: "IDLE" as TaskState, revision: 0, confirmationRequired: false });
}
export function canTransitionTask(from: TaskState, to: TaskState): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}
export function transitionTask(context: TaskContext, next: TaskState): TaskContext {
  if (!canTransitionTask(context.state, next)) throw new TaskStateTransitionError(context.state, next);
  return Object.freeze({ ...context, state: next, revision: context.revision + 1, confirmationRequired: next === "AWAITING_CONFIRMATION" });
}
export function interpretConfirmation(input: string): ConfirmationDecision {
  const normalized = input.trim().toLocaleLowerCase();
  if (!normalized) return "AMBIGUOUS";
  if (/^(?:yes|y|confirm|confirmed|start|execute|run|go|نعم|ايوه|أيوه|موافق|تأكيد|أكد|ابدأ|ابدا|نفذ|تنفيذ|شغل|شغّل)$/u.test(normalized)) return "CONFIRM";
  if (/^(?:no|n|cancel|stop|abort|لا|إلغاء|الغاء|إلغاء الأمر|الغاء الامر|توقف|أوقف|اوقف)$/u.test(normalized)) return "CANCEL";
  return "AMBIGUOUS";
}
export function confirmTask(context: TaskContext): TaskContext {
  if (context.state !== "AWAITING_CONFIRMATION") throw new TaskStateTransitionError(context.state, "EXECUTING");
  return transitionTask(context, "EXECUTING");
}
export function cancelTask(context: TaskContext): TaskContext {
  if (TERMINAL_TASK_STATES.has(context.state) && context.state !== "CANCELLED") throw new TaskStateTransitionError(context.state, "CANCELLED");
  if (context.state === "CANCELLED") return context;
  return transitionTask(context, "CANCELLED");
}
export function assertExecutionAllowed(context: TaskContext): void {
  if (!context.taskId.trim() || !context.traceId.trim()) throw new Error("Execution is blocked because task identity is missing.");
  if (!Number.isInteger(context.revision) || context.revision < 0) throw new Error("Execution is blocked because task revision is invalid.");
  if (context.state !== "EXECUTING" || context.confirmationRequired) throw new Error(`Execution is blocked until explicit confirmation. Current state: ${context.state}.`);
}
export function isTerminalTaskState(state: TaskState): boolean { return TERMINAL_TASK_STATES.has(state); }
