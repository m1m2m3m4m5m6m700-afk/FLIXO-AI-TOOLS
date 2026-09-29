import { describe, expect, it } from "vitest";
import { POST } from "../app/api/chat/route";
import { AgentResponseSchema } from "../lib/schemas/agent";

describe("chat API — planning-only canonical handoff", () => {
  it("emits a canonical local plan and never mutates media state on the server", async () => {
    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Remove background from image", history: [] }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const body = await response.text();
    expect(body).toContain("event: tool_call_start");
    expect(body).not.toContain("event: tool_call_end");
    expect(body).not.toContain("event: state_update");
    expect(body).toContain("event: agent_response");
    expect(body).toContain("event: done");

    const match = body.match(/event: agent_response\ndata: (.+?)\n\n/s);
    expect(match?.[1]).toBeDefined();
    const payload = AgentResponseSchema.parse(JSON.parse(match![1]));

    expect(payload.requestedToolCalls[0]?.toolName).toBe("background-remover");
    expect(payload.localExecutionPlans[0]?.executorId).toBe("background-remover");
    expect(payload.toolResults).toHaveLength(0);
    expect(payload.updatedProjectState).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("http://");
    expect(JSON.stringify(payload)).not.toContain("https://");
  });

  it("rejects invalid request bodies with HTTP 400", async () => {
    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "" }),
    }));
    expect(response.status).toBe(400);
  });
});
