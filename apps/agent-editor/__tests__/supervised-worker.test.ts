import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolBackedWorker } from "../lib/agent/supervised-worker";
import { ToolRegistry } from "../lib/agent/registry";

describe("createToolBackedWorker", () => {
  it("executes only an allowlisted canonical tool", async () => {
    const registry = new ToolRegistry();
    registry.register({
      meta: { name: "echo", description: "Echo", category: "utilities", executionMode: "sync", estimatedCostCredits: 0, estimatedLatencyMs: 1, supportedMediaTypes: [] },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async (input) => input,
    });

    const worker = createToolBackedWorker({ role: "implementer", toolRegistry: registry, allowedToolIds: ["echo"] });
    const report = await worker.run({
      stepId: "step-1",
      commandId: "cmd-1",
      role: "implementer",
      objective: "execute echo",
      constraints: [],
      context: { execution: { toolId: "echo", parameters: { value: "ok" } } },
    });

    expect(report.status).toBe("completed");
    expect(report.evidence?.toolId).toBe("echo");
    expect(report.evidence?.evidenceVerified).toBe(false);
  });

  it("blocks a tool outside the worker allowlist", async () => {
    const registry = new ToolRegistry();
    const worker = createToolBackedWorker({ role: "implementer", toolRegistry: registry, allowedToolIds: ["echo"] });
    const report = await worker.run({
      stepId: "step-2",
      commandId: "cmd-2",
      role: "implementer",
      objective: "execute disallowed tool",
      constraints: [],
      context: { execution: { toolId: "shell", parameters: {} } },
    });

    expect(report.status).toBe("blocked");
    expect(report.evidence?.outOfScopeActions).toBe(1);
  });
});
