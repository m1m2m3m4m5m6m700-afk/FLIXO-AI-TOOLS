import { describe, expect, it } from "vitest";
import { applyColorLutTool } from "../lib/tools/apply-color-lut";
import { removeBackgroundTool } from "../lib/tools/remove-background";
import { trimVideoTool } from "../lib/tools/trim-video";

describe("STEP 3 deterministic tool contracts", () => {
  it("validates and preserves LUT parameters", async () => {
    const output = await applyColorLutTool.execute({
      mediaUrl: "https://example.com/video.mp4",
      lutName: "teal_and_orange",
      intensity: 0.75,
    });

    expect(output.appliedLut).toBe("teal_and_orange");
    expect(output.intensityApplied).toBe(0.75);
  });

  it("rejects an invalid remove-background URL", async () => {
    await expect(
      removeBackgroundTool.execute({
        imageUrl: "not-a-url",
        threshold: 0.5,
        outputFormat: "png",
      }),
    ).rejects.toThrow();
  });

  it("computes exact trim duration", async () => {
    const output = await trimVideoTool.execute({
      videoUrl: "https://example.com/clip.mp4",
      startTimeSec: 2,
      endTimeSec: 7,
    });

    expect(output.newDurationSec).toBe(5);
    expect(output.startTimeSec).toBe(2);
    expect(output.endTimeSec).toBe(7);
  });
});
