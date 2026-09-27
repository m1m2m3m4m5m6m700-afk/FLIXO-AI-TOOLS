import { describe, expect, it } from "vitest";
import {
  AgentResponseSchema,
  AgentRuntimeOptionsSchema,
  ChatMessageSchema,
  ToolCallRequestSchema,
} from "../lib/schemas/agent";
import { AgentRuntime } from "../lib/agent/runtime";
import { createDefaultToolRegistry } from "../lib/tools";
import { ProjectStateSchema, type ProjectState } from "../lib/schemas/project";
import { LLMRouter } from "../lib/llm/router";
import type { LLMProvider } from "../lib/llm";

const ISO = "2026-09-27T00:00:00.000Z";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const VIDEO_ID = "33333333-3333-4333-8333-333333333333";

function buildProject(kind: "image" | "video"): ProjectState {
  return ProjectStateSchema.parse({
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
  });
}

describe("STEP 4 Agent Runtime", () => {
  it("uses the deterministic mock engine when no live provider is configured", async () => {
    const runtime = new AgentRuntime(
      createDefaultToolRegistry(),
      {},
      new LLMRouter([]),
    );

    const response = await runtime.processUserMessage(
      "Remove background",
      [],
      buildProject("image"),
    );

    expect(response.requestedToolCalls[0]?.toolName).toBe("remove_background");
    expect(response.updatedProjectState?.version).toBe(2);
  });

  it("calls remove_background and returns an immutable validated project", async () => {
    const runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
      maxIterations: 5,
    });
    const state = buildProject("image");
    const before = structuredClone(state);

    const response = await runtime.processUserMessage(
      "Please remove background from this picture",
      [],
      state,
    );

    expect(response.requestedToolCalls).toHaveLength(1);
    expect(response.requestedToolCalls[0]?.toolName).toBe("remove_background");
    expect(response.updatedProjectState?.layers).toHaveLength(2);
    expect(response.updatedProjectState?.version).toBe(2);
    expect(response.updatedProjectState?.updatedAt).toMatch(/Z$/);
    expect(state).toEqual(before);
    expect(AgentResponseSchema.safeParse(response).success).toBe(true);
  });

  it("calls trim_video and updates duration without mutating input", async () => {
    const runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
      maxIterations: 5,
    });
    const state = buildProject("video");
    const before = structuredClone(state);

    const response = await runtime.processUserMessage(
      "Trim this video from second 2 to 10",
      [],
      state,
    );

    expect(response.requestedToolCalls[0]?.toolName).toBe("trim_video");
    expect(response.updatedProjectState?.durationSec).toBe(8);
    expect(response.updatedProjectState?.version).toBe(2);
    expect(response.updatedProjectState?.timeline).toHaveLength(1);
    expect(state).toEqual(before);
  });

  it("calls apply_color_lut and records the applied LUT", async () => {
    const runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
      maxIterations: 5,
    });

    const response = await runtime.processUserMessage(
      "Apply a cinematic color filter",
      [],
      buildProject("image"),
    );

    const layer = response.updatedProjectState?.layers[0];
    expect(response.requestedToolCalls[0]?.toolName).toBe("apply_color_lut");
    expect(layer?.metadata.appliedLut).toBe("cinematic_warm");
    expect(response.updatedProjectState?.version).toBe(2);
  });

  it("returns a conversational response without tool calls when no tool matches", async () => {
    const runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
      maxIterations: 5,
    });

    const response = await runtime.processUserMessage(
      "Hello, what can you do?",
      [],
      buildProject("image"),
    );

    expect(response.requestedToolCalls).toHaveLength(0);
    expect(response.content).toContain(
      "registered image and video editing operations",
    );
  });

  it("is deterministic at the mock tool-call level", async () => {
    const runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
      maxIterations: 5,
    });

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

  it("rejects invalid state and non-strict agent contracts at the boundary", async () => {
    const runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
      maxIterations: 5,
    });

    await expect(
      runtime.processUserMessage(
        "Remove background",
        [],
        { ...buildProject("image"), version: 0 },
      ),
    ).rejects.toThrow();

    expect(() =>
      ToolCallRequestSchema.parse({
        callId: "call-1",
        toolName: "remove_background",
        parameters: {},
        unexpected: true,
      }),
    ).toThrow();

    expect(() =>
      ChatMessageSchema.parse({
        id: crypto.randomUUID(),
        role: "user",
        content: "hello",
        timestamp: ISO,
        unexpected: true,
      }),
    ).toThrow();
  });

  it("hard-limits the live state machine to five iterations", async () => {
    const loopingProvider: LLMProvider = {
      name: "openai",
      model: "step4-loop-test",
      isConfigured: () => true,
      stream: async function* (request) {
        const iteration =
          request.messages.filter((message) => message.role === "assistant")
            .length + 1;
        yield {
          type: "text_delta",
          text: "iteration-" + iteration,
        };
        yield {
          type: "turn_end",
          toolCalls: [
            {
              callId: "loop-" + iteration,
              toolName: "remove_background",
              arguments: {
                imageUrl: "https://example.com/flixo/input.png",
                threshold: 0.5,
                outputFormat: "png",
              },
            },
          ],
        };
      },
    };

    const runtime = new AgentRuntime(
      createDefaultToolRegistry(),
      { useMockEngine: false, maxIterations: 5 },
      new LLMRouter([loopingProvider]),
    );

    const result = await runtime.processUserMessage(
      "loop forever",
      [],
      buildProject("image"),
    );

    expect(result.requestedToolCalls).toHaveLength(5);
    expect(result.updatedProjectState?.version).toBe(6);
    expect(result.content).toContain("safety iteration limit");
  });

  it("rejects a maxIterations value above the circuit-breaker limit", () => {
    expect(() =>
      AgentRuntimeOptionsSchema.parse({ maxIterations: 6 }),
    ).toThrow();
  });
});
