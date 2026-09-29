import { describe, expect, it } from "vitest";
import { AgentResponseSchema } from "../lib/schemas/agent";

const base = (callId: string) => ({
  callId,
  toolName: "image-effects",
  parameters: {},
});

describe("RT4 agent execution budget", () => {
  it("rejects more than four tool calls in one agent response", () => {
    const result = AgentResponseSchema.safeParse({
      messageId: "00000000-0000-4000-8000-000000000001",
      content: "bounded",
      requestedToolCalls: ["a", "b", "c", "d", "e"].map(base),
      localExecutionPlans: [],
      toolResults: [],
      requiresUserConfirmation: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate tool-call identities", () => {
    const result = AgentResponseSchema.safeParse({
      messageId: "00000000-0000-4000-8000-000000000002",
      content: "bounded",
      requestedToolCalls: [base("same"), base("same")],
      localExecutionPlans: [],
      toolResults: [],
      requiresUserConfirmation: false,
    });
    expect(result.success).toBe(false);
  });
});
