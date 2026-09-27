import { readSseData } from "../sse";
import {
  LLMProviderError,
  type LLMMessage,
  type LLMProvider,
  type LLMStreamEvent,
  type LLMStreamRequest,
  type LLMToolDefinition,
} from "../types";

type GeminiPart = {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
};

type GeminiChunk = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

function toContents(messages: readonly LLMMessage[]) {
  return messages.flatMap((message) => {
    if (message.role === "tool") {
      return [{
        role: "user" as const,
        parts: (message.toolResults ?? []).map((result) => ({
          functionResponse: {
            name: result.toolName,
            response: result.result,
          },
        })),
      }];
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      return [{
        role: "model" as const,
        parts: [
          ...(message.content ? [{ text: message.content }] : []),
          ...message.toolCalls.map((call) => ({
            functionCall: {
              name: call.toolName,
              args: call.arguments,
            },
          })),
        ],
      }];
    }

    return [{
      role: message.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: message.content }],
    }];
  });
}

function toTools(tools: readonly LLMToolDefinition[]) {
  return [{
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  }];
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;

  constructor(
    public readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta",
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.model);
  }

  async *stream(request: LLMStreamRequest): AsyncGenerator<LLMStreamEvent> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: request.systemPrompt }],
        },
        contents: toContents(request.messages),
        tools: toTools(request.tools),
        generationConfig: {
          maxOutputTokens: Number(process.env.FLIXO_LLM_MAX_OUTPUT_TOKENS ?? 2048),
        },
      }),
      signal: request.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
      throw new LLMProviderError(
        "gemini",
        "Gemini request was rejected.",
        { status: response.status, retryable: response.status >= 429 || response.status >= 500 },
      );
    }

    const toolCalls: Array<{ callId: string; toolName: string; arguments: Record<string, unknown> }> = [];

    try {
      for await (const raw of readSseData(response.body, request.signal)) {
        const chunk = raw as GeminiChunk;
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.text) yield { type: "text_delta", text: part.text };
          if (part.functionCall?.name) {
            toolCalls.push({
              callId: `gemini_call_${toolCalls.length}`,
              toolName: part.functionCall.name,
              arguments: part.functionCall.args ?? {},
            });
          }
        }
      }

      yield { type: "turn_end", toolCalls };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new LLMProviderError("gemini", "Gemini streaming connection failed.", { retryable: true });
    }
  }
}
