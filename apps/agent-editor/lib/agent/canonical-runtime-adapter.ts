import {
  AgentRuntime as CanonicalAgentRuntime,
  RuntimeToolRegistry,
} from "../../../packages/agent-runtime/src/index";
import type { ExecutionRequest } from "../../../packages/contracts/src/index";
import type { ToolRegistry } from "./registry";

export function createCanonicalRuntime(
  registry: ToolRegistry,
  identity: Readonly<{ taskId: string; traceId: string }>,
): CanonicalAgentRuntime {
  const runtimeRegistry = new RuntimeToolRegistry();

  for (const registered of registry.list()) {
    const toolName = registered.name;
    runtimeRegistry.register({
      id: toolName,
      execute: async (parameters) => {
        const result = await registry.execute(
          crypto.randomUUID(),
          toolName,
          parameters,
        );
        if (result.status === "error") {
          throw new Error(result.errorDetails ?? `Tool execution failed: ${toolName}`);
        }
        return result.data ?? {};
      },
    });
  }

  return new CanonicalAgentRuntime(runtimeRegistry, identity);
}

export async function executeCanonicalTool(
  runtime: CanonicalAgentRuntime,
  request: ExecutionRequest,
) {
  return runtime.execute(request);
}
