import { z } from "zod";
import { createToolDefinition, type ToolMeta } from "../schemas/tools";
import { deterministicDelay, stableToken } from "./mock-utils";

const InputSchema = z
  .object({
    mediaUrl: z.string().url(),
    lutName: z.enum([
      "cinematic_warm",
      "teal_and_orange",
      "vintage_bw",
      "cyberpunk",
    ]),
    intensity: z.number().min(0).max(1).default(1),
  })
  .strict();

const OutputSchema = z
  .object({
    renderedMediaUrl: z.string().url(),
    appliedLut: z.string(),
    intensityApplied: z.number().min(0).max(1),
  })
  .strict();

const meta: ToolMeta = {
  name: "apply_color_lut",
  description:
    "Applies a predefined color grading LUT to an image or video layer.",
  category: "image_editing",
  executionMode: "sync",
  estimatedCostCredits: 1,
  estimatedLatencyMs: 20,
  supportedMediaTypes: ["image", "video"],
};

export const applyColorLutTool = createToolDefinition({
  meta,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async (input) => {
    await deterministicDelay(meta.estimatedLatencyMs);
    const token = stableToken([
      input.mediaUrl,
      input.lutName,
      String(input.intensity),
    ]);
    return {
      renderedMediaUrl:
        "https://example.com/flixo/rendered/" +
        token +
        "_" +
        input.lutName +
        ".mp4",
      appliedLut: input.lutName,
      intensityApplied: input.intensity,
    };
  },
});