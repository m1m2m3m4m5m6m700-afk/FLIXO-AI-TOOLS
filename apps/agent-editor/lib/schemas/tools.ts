import { z } from "zod";

export const ExecutionModeSchema = z.enum(["sync", "async_worker", "client_wasm"]);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const ToolCategorySchema = z.enum([
  "image_editing",
  "video_editing",
  "audio_processing",
  "utilities",
]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const ToolMetaSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: ToolCategorySchema,
  executionMode: ExecutionModeSchema,
  estimatedCostCredits: z.number().nonnegative().default(0),
  estimatedLatencyMs: z.number().nonnegative().default(100),
  supportedMediaTypes: z.array(z.enum(["image", "video", "audio"])),
});
export type ToolMeta = z.infer<typeof ToolMetaSchema>;

export interface ToolDefinition<
  TSchemaIn extends z.ZodTypeAny,
  TSchemaOut extends z.ZodTypeAny,
> {
  meta: ToolMeta;
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  execute: (input: z.infer<TSchemaIn>) => Promise<z.infer<TSchemaOut>>;
}

export function createToolDefinition<
  TSchemaIn extends z.ZodTypeAny,
  TSchemaOut extends z.ZodTypeAny,
>(
  definition: ToolDefinition<TSchemaIn, TSchemaOut>,
): ToolDefinition<TSchemaIn, TSchemaOut> {
  return {
    ...definition,
    execute: async (rawInput: z.infer<TSchemaIn>) => {
      const validatedInput = definition.inputSchema.parse(rawInput);
      const output = await definition.execute(validatedInput);
      return definition.outputSchema.parse(output);
    },
  };
}

export const RegisteredToolSchema = z
  .object({
    name: z.string().min(1),
    meta: z.object({
      description: z.string().min(1),
      category: ToolCategorySchema,
    }).strict(),
    jsonSchemaInput: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type RegisteredTool = z.infer<typeof RegisteredToolSchema>;
