import { z } from "zod";
import { RuntimeToolRegistry } from "@flixo/agent-runtime";
import type { ToolDefinition, RegisteredTool, ToolMeta } from "../schemas/tools";
import { ToolCallResultSchema, type ToolCallResult } from "../schemas/agent";

type StoredTool = ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>;

/**
 * Application tool catalog/validation facade.
 * Execution authority is the canonical @flixo/agent-runtime registry.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, StoredTool>();
  private readonly runtimeRegistry = new RuntimeToolRegistry();

  register<TSchemaIn extends z.ZodTypeAny, TSchemaOut extends z.ZodTypeAny>(
    tool: ToolDefinition<TSchemaIn, TSchemaOut>,
  ): void {
    const parsedMeta = this.parseMeta(tool.meta);
    if (this.tools.has(parsedMeta.name)) {
      throw new Error(`Tool with name '${parsedMeta.name}' is already registered.`);
    }

    const stored = tool as unknown as StoredTool;
    this.tools.set(parsedMeta.name, stored);
    this.runtimeRegistry.register({
      id: parsedMeta.name,
      execute: async (parameters) => {
        const parsedInput = stored.inputSchema.safeParse(parameters);
        if (!parsedInput.success) {
          throw new Error(`Invalid Tool Input Schema: ${parsedInput.error.message}`);
        }
        const output = await stored.execute(parsedInput.data);
        const parsedOutput = stored.outputSchema.safeParse(output);
        if (!parsedOutput.success) {
          throw new Error(`Invalid Tool Output Schema: ${parsedOutput.error.message}`);
        }
        if (!this.isRecord(parsedOutput.data)) {
          throw new Error("Tool output must be an object.");
        }
        return parsedOutput.data;
      },
    });
  }

  get(name: string): StoredTool {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
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
    const result = await this.runtimeRegistry.execute({
      callId,
      toolId: toolName,
      parameters: this.isRecord(rawInput) ? rawInput : {},
    });

    if (result.status === "success") {
      return this.result({
        callId,
        toolName,
        status: "success",
        data: result.data,
        executionTimeMs: result.durationMs,
      });
    }

    return this.result({
      callId,
      toolName,
      status: "error",
      errorDetails: result.error?.message,
      executionTimeMs: result.durationMs,
    });
  }

  get size(): number {
    return this.tools.size;
  }

  toRuntimeRegistry(): RuntimeToolRegistry {
    return this.runtimeRegistry;
  }

  private parseMeta(meta: ToolMeta): ToolMeta {
    return {
      ...meta,
      name: meta.name.trim(),
      description: meta.description.trim(),
      supportedMediaTypes: [...meta.supportedMediaTypes],
    };
  }

  private describeInputSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    return {
      type: "object",
      description: "Input schema is validated by Zod at runtime.",
      schemaName: schema.constructor.name,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private result(value: ToolCallResult): ToolCallResult {
    return ToolCallResultSchema.parse(value);
  }
}

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
