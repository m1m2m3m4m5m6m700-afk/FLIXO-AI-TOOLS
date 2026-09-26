import { beforeEach, describe, expect, it } from "vitest";
import { ToolRegistry } from "../lib/agent/registry";
import { createDefaultToolRegistry } from "../lib/tools";

describe("STEP 3 ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createDefaultToolRegistry();
  });

  it("registers exactly the three deterministic MVP tools", () => {
    expect(registry.size).toBe(3);
    expect(registry.list().map((tool) => tool.name)).toEqual([
      "remove_background",
      "apply_color_lut",
      "trim_video",
    ]);
  });

  it("executes a valid remove_background request", async () => {
    const result = await registry.execute("call-1", "remove_background", {
      imageUrl: "https://example.com/photo.jpg",
      threshold: 0.8,
      outputFormat: "png",
    });

    expect(result.status).toBe("success");
    expect(result.data?.processedImageUrl).toMatch(
      /^https:\/\/example\.com\/flixo\/processed\//,
    );
    expect(result.data?.maskUrl).toContain("/masks/");
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid trim ranges before execution", async () => {
    const result = await registry.execute("call-2", "trim_video", {
      videoUrl: "https://example.com/clip.mp4",
      startTimeSec: 10,
      endTimeSec: 5,
    });

    expect(result.status).toBe("error");
    expect(result.errorDetails).toContain(
      "endTimeSec must be strictly greater than startTimeSec",
    );
  });

  it("rejects unknown tools fail-closed", async () => {
    const result = await registry.execute("call-3", "non_existent_tool", {});

    expect(result.status).toBe("error");
    expect(result.errorDetails).toContain(
      "Tool 'non_existent_tool' is not registered",
    );
  });

  it("enforces duplicate-name protection", () => {
    expect(() => registry.register(registry.get("trim_video"))).toThrow(
      "Tool with name 'trim_video' is already registered.",
    );
  });

  it("returns deterministic outputs for identical inputs", async () => {
    const input = {
      imageUrl: "https://example.com/photo.jpg",
      threshold: 0.5,
      outputFormat: "webp" as const,
    };

    const first = await registry.execute("call-4", "remove_background", input);
    const second = await registry.execute("call-5", "remove_background", input);

    expect(first.data).toEqual(second.data);
  });
});
