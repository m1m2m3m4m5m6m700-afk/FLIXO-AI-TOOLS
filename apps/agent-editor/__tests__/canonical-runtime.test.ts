import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  RuntimeToolRegistry,
} from "../../packages/agent-runtime/src/index";

describe("canonical Agent Runtime", () => {
  it("requires explicit planning and confirmation before execution", async () => {
    const registry = new RuntimeToolRegistry();
    registry.register({
      id: "echo",
      execute: async (parameters) => parameters,
    });

    const runtime = new AgentRuntime(registry, {
      taskId: "task-1",
      traceId: "trace-1",
    });

    expect(runtime.state.state).toBe("IDLE");
    expect(() => runtime.execute({
      requestId: "request-1",
      taskId: "task-1",
      traceId: "trace-1",
      toolCall: {
        callId: "call-1",
        toolId: "echo",
        parameters: { value: "blocked" },
      },
    })).rejects.toThrow("RUNTIME_EXECUTION_BLOCKED:IDLE");

    runtime.plan();
    runtime.requestConfirmation();
    runtime.confirm();

    const result = await runtime.execute({
      requestId: "request-2",
      taskId: "task-1",
      traceId: "trace-1",
      toolCall: {
        callId: "call-2",
        toolId: "echo",
        parameters: { value: "ok" },
      },
    });

    expect(result.result.status).toBe("success");
    expect(result.result.data).toEqual({ value: "ok" });
  });

  it("fails closed for unknown tools", async () => {
    const runtime = new AgentRuntime(
      new RuntimeToolRegistry(),
      { taskId: "task-2", traceId: "trace-2" },
    );
    runtime.plan();
    runtime.requestConfirmation();
    runtime.confirm();

    const result = await runtime.execute({
      requestId: "request-3",
      taskId: "task-2",
      traceId: "trace-2",
      toolCall: {
        callId: "call-3",
        toolId: "missing",
        parameters: {},
      },
    });

    expect(result.result.status).toBe("error");
    expect(result.result.error?.code).toBe("UNKNOWN_TOOL");
    expect(runtime.state.state).toBe("FAILED");
  });
});
