import type { ExecutionRequest } from "@flixo/contracts";
import { AgentRuntime as CanonicalAgentRuntime } from "@flixo/agent-runtime";
import type { ToolRegistry } from "./registry";

/**
 * Thin application adapter over the canonical runtime.
 * The application-owned ToolRegistry exposes the single runtime registry instance;
 * this adapter must never create a second RuntimeToolRegistry.
 */
export function createCanonicalRuntime(
  registry: ToolRegistry,
  identity: Readonly<{ taskId: string; traceId: string }>,
): CanonicalAgentRuntime {
  return new CanonicalAgentRuntime(registry.toRuntimeRegistry(), identity);
}

export function executeCanonicalTool(
  runtime: CanonicalAgentRuntime,
  request: ExecutionRequest,
) {
  return runtime.execute(request);
}
