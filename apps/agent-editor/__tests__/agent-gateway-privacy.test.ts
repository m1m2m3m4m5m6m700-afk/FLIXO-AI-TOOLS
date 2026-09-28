import { describe, expect, it } from "vitest";
import { ChatRequestSchema, sanitizeChatRequest } from "../lib/security/request";

const baseProject = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Project",
  dimensions: { width: 1920, height: 1080, fps: 30 },
  durationSec: 0,
  layers: [{
    id: "22222222-2222-4222-8222-222222222222",
    name: "Image",
    type: "image",
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, zIndex: 0 },
  }],
  timeline: [],
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
  version: 1,
};

describe("agent gateway privacy contract", () => {
  it("accepts metadata-only project state and normalizes metadata to empty", () => {
    const request = sanitizeChatRequest({
      message: "adjust contrast",
      history: [],
      projectState: baseProject,
    });
    expect(request.projectState?.layers[0]?.url).toBeUndefined();
    expect(request.projectState?.layers[0]?.metadata).toEqual({});
    expect(request.projectState?.timeline).toEqual([]);
  });

  it("rejects raw media URLs and content in project state", () => {
    expect(() =>
      ChatRequestSchema.parse({
        message: "adjust contrast",
        history: [],
        projectState: {
          ...baseProject,
          layers: [{ ...baseProject.layers[0], url: "blob:test", content: "RAW" }],
        },
      }),
    ).toThrow();
  });

  it("rejects timeline snapshots at the gateway boundary", () => {
    expect(() =>
      ChatRequestSchema.parse({
        message: "adjust contrast",
        history: [],
        projectState: {
          ...baseProject,
          timeline: [{
            id: "33333333-3333-4333-8333-333333333333",
            timestamp: 0,
            actionType: "snapshot",
            description: "private",
            snapshotState: { raw: "data" },
          }],
        },
      }),
    ).toThrow();
  });
});
