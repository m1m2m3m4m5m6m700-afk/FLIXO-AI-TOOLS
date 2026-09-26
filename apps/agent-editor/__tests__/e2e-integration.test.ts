import { describe, expect, it } from "vitest";
import { POST } from "../app/api/chat/route";
import { ProjectStateSchema } from "../lib/schemas/project";

const project = ProjectStateSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  title: "E2E API Integration",
  dimensions: { width: 1280, height: 720, fps: 30 },
  durationSec: 10,
  layers: [{
    id: "22222222-2222-4222-8222-222222222222",
    name: "Source Photo",
    type: "image",
    url: "https://example.com/source.png",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, zIndex: 0 },
    metadata: {},
  }],
  timeline: [],
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
  version: 1,
});

describe("STEP 5 & 6 API integration: chat -> SSE -> state", () => {
  it("emits structured SSE events and a state mutation for remove background", async () => {
    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Remove background from image",
        history: [],
        projectState: project,
      }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain("event: tool_call_start");
    expect(body).toContain("event: tool_call_end");
    expect(body).toContain("event: state_update");
    expect(body).toContain("event: token");
    expect(body).toContain("event: agent_response");
    expect(body).toContain("event: done");

    const stateMatch = body.match(/event: state_update\ndata: (.+?)\n\n/s);
    expect(stateMatch?.[1]).toBeDefined();
    const updated = ProjectStateSchema.parse(JSON.parse(stateMatch![1]).projectState);
    expect(updated.version).toBe(2);
    expect(updated.layers).toHaveLength(2);
    expect(updated.layers[1]?.name).toBe("Background Removed Layer");
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
