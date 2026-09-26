import { z } from "zod";
import { ToolCallRequestSchema, ToolCallResultSchema } from "../schemas/agent";
import type {
  RegisteredTool as RegisteredToolMeta,
  ToolDefinition,
} from "../schemas/tools";

type StoredTool = ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>;

const ToolMetaRuntimeSchema = z
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
  .strict();

export class ToolRegistry {
  private readonly tools = new Map<string, StoredTool>();

  register<TSchemaIn extends z.ZodTypeAny, TSchemaOut extends z.ZodTypeAny>(
    tool: ToolDefinition<TSchemaIn, TSchemaOut>,
  ): void {
    const meta = ToolMetaRuntimeSchema.parse(tool.meta);
    if (this.tools.has(meta.name)) {
      throw new Error("Tool with name '" + meta.name + "' is already registered.");
    }
    this.tools.set(meta.name, tool as unknown as StoredTool);
  }

  get(name: string): StoredTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error("Tool '" + name + "' is not registered in the ToolRegistry.");
    }
    return tool;
  }

  list(): RegisteredToolMeta[] {
    return Array.from(this.tools.values(), (tool) => ({
      name: tool.meta.name,
      meta: {
        description: tool.meta.description,
        category: tool.meta.category,
      },
      jsonSchemaInput: {
        type: "object",
        description: "Input is enforced by the registered Zod schema.",
      },
    }));
  }

  get size(): number {
    return this.tools.size;
  }

  async execute(callId: string, toolName: string, rawInput: unknown) {
    const startedAt = Date.now();

    const request = ToolCallRequestSchema.parse({
      callId,
      toolName,
      parameters: rawInput,
    });

    let tool: StoredTool;
    try {
      tool = this.get(request.toolName);
    } catch (error) {
      const errorDetails =
        error instanceof Error ? error.message : "Unknown tool registry error.";
      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "error",
        error: "UNKNOWN_TOOL",
        errorDetails,
        executionTimeMs: Date.now() - startedAt,
      });
    }

    const parsedInput = tool.inputSchema.safeParse(request.parameters);
    if (!parsedInput.success) {
      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "error",
        error: "TOOL_INPUT_SCHEMA_INVALID",
        errorDetails: parsedInput.error.message,
        executionTimeMs: Date.now() - startedAt,
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
          errorDetails: parsedOutput.error.message,
          executionTimeMs: Date.now() - startedAt,
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
          errorDetails: "Tool output must be an object.",
          executionTimeMs: Date.now() - startedAt,
        });
      }

      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "success",
        data: parsedOutput.data as Record<string, unknown>,
        executionTimeMs: Date.now() - startedAt,
      });
    } catch (error) {
      return ToolCallResultSchema.parse({
        callId: request.callId,
        toolName: request.toolName,
        status: "error",
        error: "TOOL_EXECUTION_FAILED",
        errorDetails:
          error instanceof Error ? error.message : "Unknown tool execution failure.",
        executionTimeMs: Date.now() - startedAt,
      });
    }
  }

  parseToolOutput(toolName: string, data: unknown): Record<string, unknown> {
    const tool = this.get(toolName);
    const parsed = tool.outputSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error("TOOL_OUTPUT_SCHEMA_INVALID:" + toolName);
    }

    if (
      !parsed.data ||
      typeof parsed.data !== "object" ||
      Array.isArray(parsed.data)
    ) {
      throw new Error("TOOL_OUTPUT_NOT_OBJECT:" + toolName);
    }

    return parsed.data as Record<string, unknown>;
  }
}