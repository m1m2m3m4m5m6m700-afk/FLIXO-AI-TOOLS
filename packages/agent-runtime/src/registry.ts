import type { ToolCall, ToolResult } from "@flixo/contracts";

export type RuntimeTool = Readonly<{
  id: string;
  execute: (parameters: Readonly<Record<string, unknown>>) => Promise<Readonly<Record<string, unknown>>>;
}>;

export class RuntimeToolRegistry {
  private readonly tools = new Map<string, RuntimeTool>();

  register(tool: RuntimeTool): void {
    if (!tool.id.trim()) throw new Error("Runtime tool id is required.");
    if (this.tools.has(tool.id)) throw new Error(`Runtime tool already registered: ${tool.id}`);
    this.tools.set(tool.id, tool);
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  list(): readonly string[] {
    return Object.freeze([...this.tools.keys()]);
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.toolId);
    if (!tool) {
      return Object.freeze({
        callId: call.callId,
        toolId: call.toolId,
        status: "error",
        error: {
          code: "UNKNOWN_TOOL",
          message: `Unknown runtime tool: ${call.toolId}`,
          retryable: false,
        },
      });
    }

    const started = Date.now();
    try {
      const data = await tool.execute(call.parameters);
      return Object.freeze({
        callId: call.callId,
        toolId: call.toolId,
        status: "success",
        data,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      return Object.freeze({
        callId: call.callId,
        toolId: call.toolId,
        status: "error",
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Runtime tool execution failed.",
          retryable: true,
        },
        durationMs: Date.now() - started,
      });
    }
  }
}
