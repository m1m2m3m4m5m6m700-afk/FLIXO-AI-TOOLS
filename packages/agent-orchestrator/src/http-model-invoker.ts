import type { AgentModelInvoker, AgentModelRequest, AgentModelResponse } from "./model-adapter.ts";

export type SupportedAgentProvider = "openai" | "openrouter" | "gemini";

export type HttpAgentModelInvokerOptions = Readonly<{
  provider: SupportedAgentProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxTokens?: number;
}>;

const DEFAULT_BASE_URLS: Record<SupportedAgentProvider, string> = Object.freeze({
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com",
});

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name}_NOT_CONFIGURED`);
  return normalized;
}

function boundedTimeout(value: number | undefined): number {
  const timeout = Math.floor(value ?? 60_000);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 300_000) {
    throw new Error("AGENT_MODEL_TIMEOUT_INVALID");
  }
  return timeout;
}

function boundedTokens(value: number | undefined): number {
  const tokens = Math.floor(value ?? 4_096);
  if (!Number.isInteger(tokens) || tokens < 128 || tokens > 32_768) {
    throw new Error("AGENT_MODEL_MAX_TOKENS_INVALID");
  }
  return tokens;
}

async function requestWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractOpenAIContent(data: unknown): string {
  const value = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = value.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("AGENT_MODEL_EMPTY_PROVIDER_RESPONSE");
  return content;
}

function extractGeminiContent(data: unknown): string {
  const value = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const content = value.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  if (typeof content !== "string" || !content.trim()) throw new Error("AGENT_MODEL_EMPTY_PROVIDER_RESPONSE");
  return content;
}

export class HttpAgentModelInvoker implements AgentModelInvoker {
  private readonly provider: SupportedAgentProvider;
  private readonly model: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;

  constructor(options: HttpAgentModelInvokerOptions) {
    this.provider = options.provider;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URLS[options.provider]).replace(/\/$/u, "");
    this.timeoutMs = boundedTimeout(options.timeoutMs);
    this.maxTokens = boundedTokens(options.maxTokens);
  }

  async invoke(request: AgentModelRequest): Promise<AgentModelResponse> {
    const model = required(
      this.model
        ?? (this.provider === "openai" ? process.env.OPENAI_MODEL : undefined)
        ?? (this.provider === "openrouter" ? (process.env.OPENROUTER_MODEL ?? process.env.OPENROUTER_FREE_MODEL) : undefined)
        ?? (this.provider === "gemini" ? process.env.GEMINI_MODEL : undefined),
      "AGENT_MODEL",
    );
    const apiKey = required(
      this.apiKey
        ?? (this.provider === "openai" ? process.env.OPENAI_API_KEY : undefined)
        ?? (this.provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined)
        ?? (this.provider === "gemini" ? process.env.GEMINI_API_KEY : undefined),
      "AGENT_MODEL_API_KEY",
    );

    if (this.provider === "gemini") return this.invokeGemini(request, model, apiKey);
    return this.invokeOpenAICompatible(request, model, apiKey);
  }

  private async invokeOpenAICompatible(
    request: AgentModelRequest,
    model: string,
    apiKey: string,
  ): Promise<AgentModelResponse> {
    const response = await requestWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          ...(this.provider === "openrouter" ? {
            "HTTP-Referer": process.env.VITE_SITE_URL ?? "https://flixoai.vercel.app",
            "X-Title": "FLIXO AI Agent Network",
          } : {}),
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: 0.2,
          max_tokens: this.maxTokens,
          response_format: { type: "json_object" },
        }),
      },
      this.timeoutMs,
    );
    if (!response.ok) throw new Error(`AGENT_MODEL_PROVIDER_HTTP_${response.status}`);
    const content = extractOpenAIContent(await response.json());
    return Object.freeze({ content });
  }

  private async invokeGemini(
    request: AgentModelRequest,
    model: string,
    apiKey: string,
  ): Promise<AgentModelResponse> {
    const system = request.messages.find((message) => message.role === "system")?.content ?? "";
    const contents = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));
    const response = await requestWithTimeout(
      `${this.baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: this.maxTokens,
            responseMimeType: "application/json",
          },
        }),
      },
      this.timeoutMs,
    );
    if (!response.ok) throw new Error(`AGENT_MODEL_PROVIDER_HTTP_${response.status}`);
    const content = extractGeminiContent(await response.json());
    return Object.freeze({ content });
  }
}
