import { z } from "zod";
import { createToolDefinition, type ToolMeta } from "../schemas/tools";
import { deterministicDelay, stableToken } from "./mock-utils";

const InputSchema = z
  .object({
    videoUrl: z.string().url(),
    startTimeSec: z.number().min(0),
    endTimeSec: z.number().min(0),
  })
  .superRefine((data, ctx) => {
    if (data.endTimeSec <= data.startTimeSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTimeSec must be strictly greater than startTimeSec",
        path: ["endTimeSec"],
      });
    }
  });

const OutputSchema = z.object({
  trimmedVideoUrl: z.string().url(),
  newDurationSec: z.number().positive(),
  startTimeSec: z.number().nonnegative(),
  endTimeSec: z.number().positive(),
});

const meta: ToolMeta = {
  name: "trim_video",
  description: "Trims a video file between specified start and end timestamps.",
  category: "video_editing",
  executionMode: "async_worker",
  estimatedCostCredits: 1,
  estimatedLatencyMs: 20,
  supportedMediaTypes: ["video"],
};

export const trimVideoTool = createToolDefinition({
  meta,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async (input) => {
    await deterministicDelay(meta.estimatedLatencyMs);

    const duration = input.endTimeSec - input.startTimeSec;
    const token = stableToken([
      input.videoUrl,
      String(input.startTimeSec),
      String(input.endTimeSec),
    ]);

    return {
      trimmedVideoUrl: `https://example.com/flixo/trimmed/${token}_trimmed.mp4`,
      newDurationSec: duration,
      startTimeSec: input.startTimeSec,
      endTimeSec: input.endTimeSec,
    };
  },
});
