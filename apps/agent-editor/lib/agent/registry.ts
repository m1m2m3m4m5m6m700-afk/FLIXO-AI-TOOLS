import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ToolDefinition,
  RegisteredTool,
  ToolMeta,
  ToolMetaSchema,
} from "../schemas/tools";
import {
  ToolCallRequestSchema,
  ToolCallResultSchema,
  type ToolCallResult,
} from "../schemas/agent";

type StoredTool = ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>;

export class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`Tool '${toolName}' is not registered in the ToolRegistry.`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolExecutionError extends Error {
  constructor(toolName: string, message: string, public readonly details?: unknown) {
    super(`Execution failed for tool '${toolName}': ${message}`);
    this.name = "ToolExecutionError";
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, StoredTool>();

  register<TSchemaIn extends z.ZodTypeAny, TSchemaOut extends z.ZodTypeAny>(
    tool: ToolDefinition<TSchemaIn, TSchemaOut>,
  ): void {
    const parsedMeta = this.parseMeta(tool.meta);
    if (this.tools.has(parsedMeta.name)) {
      throw new Error(`Tool with name '${parsedMeta.name}' is already registered.`);
    }
    this.tools.set(parsedMeta.name, tool as unknown as StoredTool);
  }

  get(name: string): StoredTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }
    return tool;
  }

  list(): RegisteredTool[] {
    return Array.from(this.tools.entries(), ([name, tool]) => ({
      name,
      meta: this.parseMeta(tool.meta),
      jsonSchemaInput: this.describeInputSchema(tool.inputSchema),
    }));
  }

  async execute(
    callId: string,
    toolName: string,
    rawInput: unknown,
  ): Promise<ToolCallResult> {
    const startTime = Date.now();

    try {
      const request = ToolCallRequestSchema.parse({
        callId,
        toolName,
        parameters: rawInput,
      });

      const tool = this.get(request.toolName);
      const parsedInput = tool.inputSchema.safeParse(request.parameters);

      if (!parsedInput.success) {
        return this.result({
          callId: request.callId,
          toolName: request.toolName,
          status: "error",
          errorDetails: `Invalid Tool Input Schema: ${parsedInput.error.message}`,
          executionTimeMs: Date.now() - startTime,
        });
      }

      const rawOutput = await tool.execute(parsedInput.data);
      const parsedOutput = tool.outputSchema.safeParse(rawOutput);

      if (!parsedOutput.success) {
        return this.result({
          callId: request.callId,
          toolName: request.toolName,
          status: "error",
          errorDetails: `Invalid Tool Output Schema: ${parsedOutput.error.message}`,
          executionTimeMs: Date.now() - startTime,
        });
      }

      if (!this.isRecord(parsedOutput.data)) {
        throw new ToolExecutionError(
          request.toolName,
          "Tool output must be an object for ToolCallResult.data.",
        );
      }

      return this.result({
        callId: request.callId,
        toolName: request.toolName,
        status: "success",
        data: parsedOutput.data,
        executionTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown tool execution failure.";
      return this.result({
        callId,
        toolName,
        status: "error",
        errorDetails: errorMessage,
        executionTimeMs: Date.now() - startTime,
      });
    }
  }

  parseToolOutput(toolName: string, data: unknown): Record<string, unknown> {
    const tool = this.get(toolName);
    const parsed = tool.outputSchema.parse(data);
    if (!this.isRecord(parsed)) {
      throw new ToolExecutionError(toolName, "Validated tool output must be an object.");
    }
    return parsed;
  }

  get size(): number {
    return this.tools.size;
  }

  private parseMeta(meta: ToolMeta): ToolMeta {
    return ToolMetaSchema.parse({
      ...meta,
      name: meta.name.trim(),
      description: meta.description.trim(),
      supportedMediaTypes: [...meta.supportedMediaTypes],
    });
  }

  private describeInputSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    const jsonSchema = zodToJsonSchema(schema, {
      $refStrategy: "none",
      target: "jsonSchema7",
    }) as Record<string, unknown>;

    delete jsonSchema.$schema;
    return jsonSchema;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private result(value: ToolCallResult): ToolCallResult {
    return ToolCallResultSchema.parse(value);
  }
}
