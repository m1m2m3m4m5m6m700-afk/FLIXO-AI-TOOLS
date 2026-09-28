import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  RuntimeToolRegistry,
} from "@flixo/agent-runtime";
import { createCanonicalRuntime } from "../lib/agent/canonical-runtime-adapter";
import { ToolRegistry } from "../lib/agent/registry";
import { z } from "zod";

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


describe("agent-editor runtime adapter boundary", () => {
  it("builds the application adapter on top of the canonical runtime registry", async () => {
    const registry = new ToolRegistry();
    registry.register({
      meta: {
        name: "echo",
        description: "Echo input",
        category: "utilities",
        executionMode: "sync",
        estimatedCostCredits: 0,
        estimatedLatencyMs: 1,
        supportedMediaTypes: ["image"],
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async (input) => input,
    });

    const runtime = createCanonicalRuntime(registry, {
      taskId: "adapter-task",
      traceId: "adapter-trace",
    });

    runtime.plan();
    runtime.requestConfirmation();
    runtime.confirm();

    const result = await runtime.execute({
      requestId: "adapter-request",
      taskId: "adapter-task",
      traceId: "adapter-trace",
      toolCall: {
        callId: "adapter-call",
        toolId: "echo",
        parameters: { value: "ok" },
      },
    });

    expect(result.result.status).toBe("success");
    expect(result.result.data).toEqual({ value: "ok" });
  });
});
