import type { AgentModelInvoker, AgentModelMessage, AgentModelRequest, AgentModelResponse } from "@flixo/agent-orchestrator";
import { selectModelForTask, type ModelTaskKind } from "../../../../src/lib/agent/model-router";

export type RoutedProvider = "openai" | "openrouter" | "gemini";

export type FlixoRoutedModelInvokerOptions = Readonly<{
  provider: RoutedProvider;
  fallbackProvider?: RoutedProvider | null;
  timeoutMs: number;
  maxTokens: number;
  env?: Record<string, string | undefined>;
  callProvider: (
    provider: RoutedProvider,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    timeoutMs: number,
    maxTokens: number,
    model: string,
  ) => Promise<string>;
}>;

export class FlixoRoutedModelInvoker implements AgentModelInvoker {
  constructor(private readonly options: FlixoRoutedModelInvokerOptions) {}

  async invoke(request: AgentModelRequest): Promise<AgentModelResponse> {
    const primary = this.select(request, this.options.provider);
    try {
      const content = await this.call(primary, request.messages);
      return Object.freeze({
        content,
        evidence: Object.freeze({ provider: primary.provider, model: primary.model, task: primary.task }),
      });
    } catch (error) {
      const fallbackProvider = this.options.fallbackProvider;
      if (!fallbackProvider) throw error;
      const fallback = this.select(request, fallbackProvider);
      const content = await this.call(fallback, request.messages);
      return Object.freeze({
        content,
        evidence: Object.freeze({ provider: fallback.provider, model: fallback.model, task: fallback.task, fallback: true }),
      });
    }
  }

  private select(request: AgentModelRequest, provider: RoutedProvider) {
    return selectModelForTask({
      taskInput: request.instruction.objective,
      provider,
      env: this.options.env,
    });
  }

  private call(
    selection: ReturnType<typeof selectModelForTask>,
    messages: readonly AgentModelMessage[],
  ): Promise<string> {
    return this.options.callProvider(
      selection.provider as RoutedProvider,
      messages.map((message) => ({ role: message.role, content: message.content })),
      this.options.timeoutMs,
      this.options.maxTokens,
      selection.model,
    );
  }
}
