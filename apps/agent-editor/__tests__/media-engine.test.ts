import { describe, expect, it } from "vitest";
import {
  getLayerSourceTime,
  getMaxFrameIndex,
  isLayerActiveAtFrame,
  resolveFrameSync,
} from "../lib/media/frame-sync";
import type { ProjectState } from "../lib/schemas/project";

const ISO = "2026-09-27T00:00:00.000Z";

function buildProject(): ProjectState {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Media Engine",
    dimensions: { width: 1280, height: 720, fps: 30 },
    durationSec: 10,
    layers: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Video",
        type: "video",
        url: "https://example.com/source.mp4",
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0, zIndex: 0 },
        timeframe: {
          startTimeSec: 2,
          endTimeSec: 7,
          trimStartSec: 4,
          trimEndSec: 9,
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

describe("client-side media engine contracts", () => {
  it("maps scrub time to a deterministic integer frame", () => {
    const project = buildProject();
    expect(getMaxFrameIndex(project)).toBe(299);

    const exact = resolveFrameSync(project, 1.001);
    expect(exact.frameIndex).toBe(30);
    expect(exact.timeSec).toBeCloseTo(1, 8);

    const end = resolveFrameSync(project, 99);
    expect(end.frameIndex).toBe(299);
    expect(end.timeSec).toBeCloseTo(299 / 30, 8);
  });

  it("activates layers using timeline time, not source trim time", () => {
    const project = buildProject();
    expect(isLayerActiveAtFrame(project.layers[0]!, 60, 30)).toBe(true);
    expect(isLayerActiveAtFrame(project.layers[0]!, 210, 30)).toBe(false);
  });

  it("maps a timeline frame to the trimmed source timestamp", () => {
    const project = buildProject();
    expect(getLayerSourceTime(project.layers[0]!, 60, 30)).toBe(4);
    expect(getLayerSourceTime(project.layers[0]!, 120, 30)).toBe(6);
    expect(getLayerSourceTime(project.layers[0]!, 270, 30)).toBe(9);
  });
});