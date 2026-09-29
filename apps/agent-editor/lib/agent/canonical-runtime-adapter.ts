import {
  AgentRuntime as CanonicalAgentRuntime,
} from "@flixo/agent-runtime";
import type { ExecutionRequest } from "@flixo/contracts";
import type { ToolRegistry } from "./registry";

export function createCanonicalRuntime(
  registry: ToolRegistry,
  identity: Readonly<{ taskId: string; traceId: string }>,
): CanonicalAgentRuntime {
  return new CanonicalAgentRuntime(registry.toRuntimeRegistry(), identity);
}

export async function executeCanonicalTool(
  runtime: CanonicalAgentRuntime,
  request: ExecutionRequest,
) {
  return runtime.execute(request);
}
