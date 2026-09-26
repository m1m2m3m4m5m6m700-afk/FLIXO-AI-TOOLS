import { beforeEach, describe, expect, it } from "vitest";
import { AgentResponseSchema } from "../lib/schemas/agent";
import { AgentRuntime } from "../lib/agent/runtime";
import { createDefaultToolRegistry } from "../lib/tools";
import type { ProjectState } from "../lib/schemas/project";

const ISO = "2026-09-27T00:00:00.000Z";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const VIDEO_ID = "33333333-3333-4333-8333-333333333333";

function buildProject(kind: "image" | "video"): ProjectState {
  return {
    id: PROJECT_ID,
    title: "Test Project",
    dimensions: { width: 1920, height: 1080, fps: 30 },
    durationSec: 10,
    layers: [
      {
        id: kind === "image" ? IMAGE_ID : VIDEO_ID,
        name: kind === "image" ? "Original Photo" : "Original Video",
        type: kind,
        url:
          kind === "image"
            ? "https://example.com/original.png"
            : "https://example.com/original.mp4",
        visible: true,
        locked: false,
        opacity: 1,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          zIndex: 0,
        },
        metadata: {},
      },
    ],
    timeline: [],
    createdAt: ISO,
    updatedAt: ISO,
    version: 1,
  };
}

describe("STEP 4 Agent Runtime", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
      maxIterations: 5,
    });
  });

  it("calls remove_background and returns a validated updated project", async () => {
    const response = await runtime.processUserMessage(
      "Please remove background from this picture",
      [],
      buildProject("image"),
    );

    expect(response.requestedToolCalls).toHaveLength(1);
    expect(response.requestedToolCalls[0]?.toolName).toBe("remove_background");
    expect(response.updatedProjectState?.layers).toHaveLength(2);
    expect(response.updatedProjectState?.version).toBe(2);
    expect(AgentResponseSchema.safeParse(response).success).toBe(true);
  });

  it("calls trim_video and updates duration on a video project", async () => {
    const response = await runtime.processUserMessage(
      "Trim this video from second 2 to 10",
      [],
      buildProject("video"),
    );

    expect(response.requestedToolCalls[0]?.toolName).toBe("trim_video");
    expect(response.updatedProjectState?.durationSec).toBe(8);
    expect(response.updatedProjectState?.version).toBe(2);
    expect(response.updatedProjectState?.timeline).toHaveLength(1);
  });

  it("calls apply_color_lut and records the applied LUT", async () => {
    const response = await runtime.processUserMessage(
      "Apply a cinematic color filter",
      [],
      buildProject("image"),
    );

    const layer = response.updatedProjectState?.layers[0];
    expect(response.requestedToolCalls[0]?.toolName).toBe("apply_color_lut");
    expect(layer?.metadata.appliedLut).toBe("cinematic_warm");
    expect(response.updatedProjectState?.timeline).toHaveLength(1);
  });

  it("returns a conversational response without tool calls when no tool matches", async () => {
    const response = await runtime.processUserMessage(
      "Hello, what can you do?",
      [],
      buildProject("image"),
    );

    expect(response.requestedToolCalls).toHaveLength(0);
    expect(response.content).toContain("registered image and video editing operations");
  });

  it("is deterministic at the mock-LLM tool-call level", async () => {
    const first = await runtime.processUserMessage(
      "remove background",
      [],
      buildProject("image"),
    );
    const second = await runtime.processUserMessage(
      "remove background",
      [],
      buildProject("image"),
    );

    expect(first.requestedToolCalls).toEqual(second.requestedToolCalls);
  });
});
