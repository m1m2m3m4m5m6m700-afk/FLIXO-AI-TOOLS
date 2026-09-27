export const TASK_STATES = [
  "IDLE",
  "NEEDS_INPUT",
  "PLANNED",
  "AWAITING_CONFIRMATION",
  "EXECUTING",
  "VERIFYING",
  "RECOVERING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export type AgentRole = "system" | "user" | "assistant" | "tool";

export type AgentMessage = Readonly<{
  id: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}>;

export type ToolCall = Readonly<{
  callId: string;
  toolId: string;
  parameters: Readonly<Record<string, unknown>>;
}>;

export type ToolResultStatus = "success" | "error";

export type ToolResult = Readonly<{
  callId: string;
  toolId: string;
  status: ToolResultStatus;
  data?: Readonly<Record<string, unknown>>;
  error?: Readonly<{
    code: string;
    message: string;
    retryable: boolean;
  }>;
  durationMs?: number;
}>;

export type ExecutionRequest = Readonly<{
  requestId: string;
  taskId: string;
  traceId: string;
  toolCall: ToolCall;
}>;

export type ExecutionResult = Readonly<{
  requestId: string;
  taskId: string;
  traceId: string;
  result: ToolResult;
}>;

export type AgentResponse = Readonly<{
  messageId: string;
  content: string;
  toolCalls: readonly ToolCall[];
  toolResults: readonly ToolResult[];
  requiresUserConfirmation: boolean;
}>;

export type ContractFailureCode =
  | "INVALID_INPUT"
  | "UNKNOWN_TOOL"
  | "CAPABILITY_NOT_EXECUTABLE"
  | "EXECUTOR_UNAVAILABLE"
  | "VERIFIER_UNAVAILABLE"
  | "OUTPUT_CONTRACT_MISSING"
  | "EXECUTION_REJECTED"
  | "EXECUTION_FAILED";

export const CONTRACT_VERSION = "1.0.0" as const;

export function createContractFailure(
  code: ContractFailureCode,
  message: string,
  retryable = false,
): NonNullable<ToolResult["error"]> {
  return Object.freeze({ code, message, retryable });
}

export type CognitiveVerificationState = "pending" | "verified" | "rejected" | "unresolved";

export type AgentCognitiveStateContract = Readonly<{
  commandId: string;
  stepId: string;
  agentId: string;
  goal: string;
  hypotheses: readonly string[];
  assumptions: readonly string[];
  plannedActions: readonly string[];
  observations: readonly string[];
  evidence: readonly string[];
  uncertainties: readonly string[];
  detectedRisks: readonly string[];
  rejectedApproaches: readonly string[];
  decision?: string;
  confidence: number;
  verificationState: CognitiveVerificationState;
  updatedAt: string;
}>;

export type AgentDecisionContract = Readonly<{
  id: string;
  commandId: string;
  stepId: string;
  agentId: string;
  decision: string;
  alternatives: readonly string[];
  evidence: readonly string[];
  confidence: number;
  verificationState: CognitiveVerificationState;
  outcome?: string;
  reward?: number;
  timestamp: string;
}>;
