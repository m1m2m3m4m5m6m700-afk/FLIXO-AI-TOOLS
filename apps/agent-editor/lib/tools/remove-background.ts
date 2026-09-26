import { z } from "zod";
import { createToolDefinition, type ToolMeta } from "../schemas/tools";
import { deterministicDelay, stableToken } from "./mock-utils";

const InputSchema = z
  .object({
    imageUrl: z.string().url(),
    threshold: z.number().min(0).max(1).default(0.5),
    outputFormat: z.enum(["png", "webp"]).default("png"),
  })
  .strict();

const OutputSchema = z
  .object({
    processedImageUrl: z.string().url(),
    maskUrl: z.string().url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const meta: ToolMeta = {
  name: "remove_background",
  description:
    "Removes the primary background from an image layer and generates an alpha mask.",
  category: "image_editing",
  executionMode: "async_worker",
  estimatedCostCredits: 2,
  estimatedLatencyMs: 20,
  supportedMediaTypes: ["image"],
};

export const removeBackgroundTool = createToolDefinition({
  meta,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async (input) => {
    await deterministicDelay(meta.estimatedLatencyMs);
    const token = stableToken([
      input.imageUrl,
      String(input.threshold),
      input.outputFormat,
    ]);
    return {
      processedImageUrl:
        "https://example.com/flixo/processed/" +
        token +
        "_nobg." +
        input.outputFormat,
      maskUrl: "https://example.com/flixo/masks/" + token + "_mask.png",
      width: 1920,
      height: 1080,
    };
  },
});