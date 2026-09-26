import { beforeEach, describe, expect, it } from "vitest";
import { AgentResponseSchema } from "../lib/schemas/agent";
import { AgentRuntime } from "../lib/agent/runtime";
import { createDefaultToolRegistry } from "../lib/tools";
import { ProjectStateSchema, type ProjectState } from "../lib/schemas/project";

const ISO = "2026-09-27T00:00:00.000Z";

function buildProject(kind: "image" | "video"): ProjectState {
  return ProjectStateSchema.parse({
    id: "p1",
    title: "Test Project",
    dimensions: { width: 1920, height: 1080, fps: 30 },
    durationSec: 10,
    layers: [
      {
        id: kind === "image" ? "l1" : "video-1",
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
  });
}

describe("STEP 4: Agent Runtime Contracts", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = new AgentRuntime({
      registry: createDefaultToolRegistry(),
      useMockEngine: true,
      maxIterations: 5,
    });
  });

  it("triggers background removal and applies an immutable state mutation", async () => {
    const state = buildProject("image");
    const before = structuredClone(state);

    const response = await runtime.processUserMessage(
      "Remove background",
      [],
      state,
    );

    expect(response.requestedToolCalls[0]?.toolName).toBe("remove_background");
    expect(response.updatedProjectState?.layers.length).toBe(2);
    expect(response.updatedProjectState?.version).toBe(2);
    expect(response.updatedProjectState?.updatedAt).toMatch(/Z$/);
    expect(state).toEqual(before);
    expect(AgentResponseSchema.safeParse(response).success).toBe(true);
  });

  it("handles a conversational prompt with zero tool calls", async () => {
    const response = await runtime.processUserMessage(
      "Hello agent",
      [],
      buildProject("image"),
    );

    expect(response.requestedToolCalls).toHaveLength(0);
    expect(response.content).toContain("registered image and video editing operations");
  });

  it("handles color LUT mutation through the validated output contract", async () => {
    const response = await runtime.processUserMessage(
      "Apply a cinematic color filter",
      [],
      buildProject("image"),
    );

    expect(response.requestedToolCalls[0]?.toolName).toBe("apply_color_lut");
    expect(response.updatedProjectState?.layers[0]?.metadata.appliedLut).toBe(
      "cinematic_warm",
    );
    expect(response.updatedProjectState?.version).toBe(2);
  });

  it("handles trim_video and updates duration", async () => {
    const response = await runtime.processUserMessage(
      "Trim the video",
      [],
      buildProject("video"),
    );

    expect(response.requestedToolCalls[0]?.toolName).toBe("trim_video");
    expect(response.updatedProjectState?.durationSec).toBe(8);
    expect(response.updatedProjectState?.version).toBe(2);
    expect(response.updatedProjectState?.timeline).toHaveLength(1);
  });

  it("produces deterministic mock decisions for identical inputs", async () => {
    const first = await runtime.processUserMessage(
      "Remove background",
      [],
      buildProject("image"),
    );
    const second = await runtime.processUserMessage(
      "Remove background",
      [],
      buildProject("image"),
    );

    expect(first.requestedToolCalls).toEqual(second.requestedToolCalls);
  });

  it("rejects invalid project state at the runtime boundary", async () => {
    const invalidState = { ...buildProject("image"), version: 0 };

    await expect(
      runtime.processUserMessage("Remove background", [], invalidState),
    ).rejects.toThrow();
  });

  it("fail-closes unknown tool execution", async () => {
    const result = await createDefaultToolRegistry().execute(
      "call-x",
      "unknown_tool",
      {},
    );

    expect(result.status).toBe("error");
    expect(result.error).toBe("UNKNOWN_TOOL");
  });

  it("hard-limits the state machine to five iterations", async () => {
    const loopingRuntime = new AgentRuntime({
      registry: createDefaultToolRegistry(),
      useMockEngine: false,
      maxIterations: 5,
      reasoningEngine: async ({ callIndex }) => ({
        content: "iteration-" + callIndex,
        toolCalls: [
          {
            callId: "loop-" + callIndex,
            toolName: "remove_background",
            parameters: {
              imageUrl: "https://example.com/flixo/input.png",
              threshold: 0.5,
              outputFormat: "png",
            },
          },
        ],
      }),
    });

    const result = await loopingRuntime.processUserMessage(
      "loop",
      [],
      buildProject("image"),
    );

    expect(result.requestedToolCalls).toHaveLength(5);
    expect(result.content).toBe("iteration-5");
    expect(result.updatedProjectState?.version).toBe(6);
  });
});