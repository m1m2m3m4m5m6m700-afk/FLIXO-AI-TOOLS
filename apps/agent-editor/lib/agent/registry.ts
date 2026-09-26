import { z } from "zod";
import { ToolCallRequestSchema, ToolCallResultSchema } from "../schemas/agent";
import type {
  RegisteredTool as RegisteredToolMeta,
  ToolDefinition,
} from "../schemas/tools";

type StoredTool = ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>;

export class ToolRegistry {
  private readonly tools = new Map<string, StoredTool>();

  register<TSchemaIn extends z.ZodTypeAny, TSchemaOut extends z.ZodTypeAny>(
    tool: ToolDefinition<TSchemaIn, TSchemaOut>,
  ): void {
    const meta = z
      .object({
        name: z.string().min(1).max(128),
        description: z.string().min(1).max(4_000),
        category: z.enum([
          "image_editing",
          "video_editing",
          "audio_processing",
          "utilities",
        ]),
        executionMode: z.enum(["sync", "async_worker", "client_wasm"]),
        estimatedCostCredits: z.number().finite().nonnegative(),
        estimatedLatencyMs: z.number().finite().nonnegative(),
        supportedMediaTypes: z.array(z.enum(["image", "video", "audio"])),
      })
      .strict()
      .parse(tool.meta);

    if (this.tools.has(meta.name)) {
      throw new Error("TOOL_ALREADY_REGISTERED:" + meta.name);
    }

    this.tools.set(meta.name, tool as StoredTool);
  }

  get(name: string): StoredTool | undefined {
    return this.tools.get(name);
  }

  list(): RegisteredToolMeta[] {
    return Array.from(this.tools.values(), (tool) => ({
      name: tool.meta.name,
      meta: {
        description: tool.meta.description,
        category: this.toPromptCategory(tool.meta.category),
      },
    }));
  }

  async execute(
    callId: string,
    toolName: string,
    rawInput: unknown,
  ) {
    const request = ToolCallRequestSchema.parse({
      callId,
      toolName,
      parameters: rawInput,
    });

    const tool = this.get(request.toolName);
    if (!tool) {
      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "error",
        error: "UNKNOWN_TOOL",
      });
    }

    const parsedInput = tool.inputSchema.safeParse(request.parameters);
    if (!parsedInput.success) {
      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "error",
        error: "TOOL_INPUT_SCHEMA_INVALID",
      });
    }

    try {
      const rawOutput = await tool.execute(parsedInput.data);
      const parsedOutput = tool.outputSchema.safeParse(rawOutput);

      if (!parsedOutput.success) {
        return ToolCallResultSchema.parse({
          callId: request.callId,
          toolName: request.toolName,
          status: "error",
          error: "TOOL_OUTPUT_SCHEMA_INVALID",
        });
      }

      if (
        !parsedOutput.data ||
        typeof parsedOutput.data !== "object" ||
        Array.isArray(parsedOutput.data)
      ) {
        return ToolCallResultSchema.parse({
          callId: request.callId,
          toolName: request.toolName,
          status: "error",
          error: "TOOL_OUTPUT_NOT_OBJECT",
        });
      }

      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "success",
        data: parsedOutput.data as Record<string, unknown>,
      });
    } catch {
      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "error",
        error: "TOOL_EXECUTION_FAILED",
      });
    }
  }

  parseToolOutput(toolName: string, data: unknown): Record<string, unknown> {
    const tool = this.get(toolName);
    if (!tool) {
      throw new Error("UNKNOWN_TOOL:" + toolName);
    }

    const parsed = tool.outputSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("TOOL_OUTPUT_SCHEMA_INVALID:" + toolName);
    }

    if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
      throw new Error("TOOL_OUTPUT_NOT_OBJECT:" + toolName);
    }

    return parsed.data as Record<string, unknown>;
  }

  private toPromptCategory(
    category: z.infer<typeof z.enum>,
  ): "image_editing" | "video_editing" | "audio_processing" | "utilities" {
    return category;
  }
}