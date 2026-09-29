import type { AgentResponse, LocalExecutionPlan, ToolCallRequest } from "../schemas/agent";

export type PendingAgentExecution = Readonly<{
  requestedToolCalls: readonly ToolCallRequest[];
  localExecutionPlans: readonly LocalExecutionPlan[];
}>;

/**
 * Agent-generated local mutations are never executable without an explicit
 * confirmation decision carried separately from the model response.
 */
export function prepareAgentLocalExecution(
  response: AgentResponse,
): PendingAgentExecution | null {
  if (response.localExecutionPlans.length === 0) return null;
  if (response.requiresUserConfirmation !== true) {
    throw new Error("AGENT_EXECUTION_CONFIRMATION_REQUIRED");
  }
  if (response.requestedToolCalls.length === 0) {
    throw new Error("AGENT_EXECUTION_REQUESTS_MISSING");
  }

  for (const call of response.requestedToolCalls) {
    const plan = response.localExecutionPlans.find(
      (candidate) => candidate.callId === call.callId,
    );
    if (!plan) throw new Error("AGENT_EXECUTION_PLAN_MISSING");
    if (plan.toolName !== call.toolName) {
      throw new Error("AGENT_EXECUTION_PLAN_MISMATCH");
    }
  }

  return Object.freeze({
    requestedToolCalls: response.requestedToolCalls,
    localExecutionPlans: response.localExecutionPlans,
  });
}
