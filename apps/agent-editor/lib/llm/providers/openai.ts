import { readSseData } from "../sse";
import {
  LLMProviderError,
  type LLMMessage,
  type LLMProvider,
  type LLMStreamEvent,
  type LLMStreamRequest,
  type LLMToolDefinition,
  type LLMProviderName,
} from "../types";

type OpenAIChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
};

function toMessages(systemPrompt: string, messages: readonly LLMMessage[]): unknown[] {
  return [
    { role: "system", content: systemPrompt },
    ...messages.flatMap((message): unknown[] => {
      if (message.role === "tool") {
        return (message.toolResults ?? []).map((result) => ({
          role: "tool" as const,
          tool_call_id: result.callId,
          name: result.toolName,
          content: JSON.stringify(result.result),
        }));
      }

      if (message.role === "assistant" && message.toolCalls?.length) {
        return [{
          role: "assistant" as const,
          content: message.content || null,
          tool_calls: message.toolCalls.map((call) => ({
            id: call.callId,
            type: "function" as const,
            function: {
              name: call.toolName,
              arguments: JSON.stringify(call.arguments),
            },
          })),
        }];
      }

      return [{ role: message.role, content: message.content }];
    }),
  ];
}

function toTools(tools: readonly LLMToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export class OpenAIProvider implements LLMProvider {
  readonly name: LLMProviderName;

  constructor(
    public readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1/chat/completions",
    name: LLMProviderName = "openai",
    private readonly requiresApiKey = true,
  ) {
    this.name = name;
  }

  isConfigured(): boolean {
    return Boolean(this.model && this.baseUrl && (!this.requiresApiKey || this.apiKey));
  }

  async *stream(request: LLMStreamRequest): AsyncGenerator<LLMStreamEvent> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: request.model,
        messages: toMessages(request.systemPrompt, request.messages),
        tools: toTools(request.tools),
        tool_choice: "auto",
        stream: true,
      }),
      signal: request.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
      throw new LLMProviderError(
        this.name,
        "OpenAI-compatible request was rejected.",
        { status: response.status, retryable: response.status >= 429 || response.status >= 500 },
      );
    }

    const toolCalls = new Map<number, { callId: string; toolName: string; arguments: string }>();

    try {
      for await (const raw of readSseData(response.body, request.signal)) {
        const chunk = raw as OpenAIChunk;
        const delta = chunk.choices?.[0]?.delta;

        if (typeof delta?.content === "string" && delta.content) {
          yield { type: "text_delta", text: delta.content };
        }

        for (const call of delta?.tool_calls ?? []) {
          const current = toolCalls.get(call.index) ?? {
            callId: call.id ?? `openai_call_${call.index}`,
            toolName: "",
            arguments: "",
          };

          if (call.id) current.callId = call.id;
          if (call.function?.name) current.toolName += call.function.name;
          if (call.function?.arguments) current.arguments += call.function.arguments;
          toolCalls.set(call.index, current);
        }
      }

      const normalizedCalls = [];
      for (const call of toolCalls.values()) {
        if (!call.toolName) {
          throw new LLMProviderError(
            this.name,
            "OpenAI-compatible response returned a tool call without a function name.",
            { retryable: true },
          );
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(call.arguments) as unknown;
        } catch {
          throw new LLMProviderError(
            this.name,
            "OpenAI-compatible response returned malformed tool arguments.",
            { retryable: true },
          );
        }

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new LLMProviderError(
            this.name,
            "OpenAI-compatible response returned a non-object tool argument payload.",
            { retryable: true },
          );
        }

        normalizedCalls.push({
          callId: call.callId,
          toolName: call.toolName,
          arguments: parsed as Record<string, unknown>,
        });
      }

      yield { type: "turn_end", toolCalls: normalizedCalls };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new LLMProviderError(
        this.name,
        "OpenAI-compatible streaming connection failed.",
        { retryable: true },
      );
    }
  }
}
