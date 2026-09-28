import assert from "node:assert/strict";
import test from "node:test";
import { AgentRuntime, RuntimeToolRegistry } from "@flixo/agent-runtime";

test("canonical runtime rejects a tool result that completes after cancellation", async () => {
  const registry = new RuntimeToolRegistry();
  let release!: () => void;
  registry.register({
    id: "slow",
    execute: async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { value: "stale" };
    },
  });

  const runtime = new AgentRuntime(registry, { taskId: "task-stale", traceId: "trace-stale" });
  runtime.plan();
  runtime.requestConfirmation();
  runtime.confirm();

  const execution = runtime.execute({
    requestId: "request-stale",
    taskId: "task-stale",
    traceId: "trace-stale",
    toolCall: { callId: "call-stale", toolId: "slow", parameters: {} },
  });

  runtime.cancel();
  release();

  const result = await execution;
  assert.equal(result.result.status, "error");
  assert.equal(result.result.error?.code, "EXECUTION_REJECTED");
  assert.equal(runtime.state.state, "CANCELLED");
});
