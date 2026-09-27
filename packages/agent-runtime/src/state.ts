import type { TaskState } from "@flixo/contracts";

export const RUNTIME_STATES = [
  "IDLE",
  "PLANNED",
  "AWAITING_CONFIRMATION",
  "EXECUTING",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type RuntimeState = (typeof RUNTIME_STATES)[number];

const TRANSITIONS: Readonly<Record<RuntimeState, readonly RuntimeState[]>> = {
  IDLE: ["PLANNED", "CANCELLED"],
  PLANNED: ["AWAITING_CONFIRMATION", "CANCELLED"],
  AWAITING_CONFIRMATION: ["EXECUTING", "CANCELLED"],
  EXECUTING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["EXECUTING", "COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: RuntimeState, to: RuntimeState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: RuntimeState, to: RuntimeState): RuntimeState {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid runtime transition: ${from} -> ${to}`);
  }
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
