import { readSseData } from "../sse";
import {
  LLMProviderError,
  type LLMMessage,
  type LLMProvider,
  type LLMStreamEvent,
  type LLMStreamRequest,
  type LLMToolDefinition,
} from "../types";

type AnthropicEvent = {
  type?: string;
  index?: number;
  content_block?: {
    type?: string;
    id?: string;
    name?: string;
  };
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
  };
};

function toMessages(messages: readonly LLMMessage[]): unknown[] {
  return messages.flatMap((message): unknown[] => {
    if (message.role === "tool") {
      return [{
        role: "user" as const,
        content: (message.toolResults ?? []).map((result) => ({
          type: "tool_result" as const,
          tool_use_id: result.callId,
          content: JSON.stringify(result.result),
          is_error: result.isError,
        })),
      }];
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      return [{
        role: "assistant" as const,
        content: [
          ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
          ...message.toolCalls.map((call) => ({
            type: "tool_use" as const,
            id: call.callId,
            name: call.toolName,
            input: call.arguments,
          })),
        ],
      }];
    }

    return [{
      role: message.role === "assistant" ? "assistant" as const : "user" as const,
      content: message.content,
    }];
  });
}

function toTools(tools: readonly LLMToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;

  constructor(
    public readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.anthropic.com/v1/messages",
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.model);
  }

  async *stream(request: LLMStreamRequest): AsyncGenerator<LLMStreamEvent> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: Number(process.env.FLIXO_LLM_MAX_OUTPUT_TOKENS ?? 2048),
        system: request.systemPrompt,
        messages: toMessages(request.messages),
        tools: toTools(request.tools),
        stream: true,
      }),
      signal: request.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
      throw new LLMProviderError(
        "anthropic",
        "Anthropic request was rejected.",
        { status: response.status, retryable: response.status >= 429 || response.status >= 500 },
      );
    }

    const toolCalls = new Map<number, { callId: string; toolName: string; arguments: string }>();

    try {
      for await (const raw of readSseData(response.body, request.signal)) {
        const event = raw as AnthropicEvent;

        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          toolCalls.set(event.index ?? toolCalls.size, {
            callId: event.content_block.id ?? `anthropic_call_${event.index ?? toolCalls.size}`,
            toolName: event.content_block.name ?? "",
            arguments: "",
          });
          continue;
        }

        if (event.type === "content_block_delta") {
          if (event.delta?.type === "text_delta" && event.delta.text) {
            yield { type: "text_delta", text: event.delta.text };
          }

          if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
            const current = toolCalls.get(event.index ?? -1);
            if (current) current.arguments += event.delta.partial_json;
          }
        }
      }

      const normalizedCalls = [];
      for (const call of toolCalls.values()) {
        if (!call.toolName) {
          throw new LLMProviderError(
            "anthropic",
            "Anthropic returned a tool call without a function name.",
            { retryable: true },
          );
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(call.arguments) as unknown;
        } catch {
          throw new LLMProviderError(
            "anthropic",
            "Anthropic returned malformed tool arguments.",
            { retryable: true },
          );
        }

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new LLMProviderError(
            "anthropic",
            "Anthropic returned a non-object tool argument payload.",
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
        "anthropic",
        "Anthropic streaming connection failed.",
        { retryable: true },
      );
    }
  }
}
