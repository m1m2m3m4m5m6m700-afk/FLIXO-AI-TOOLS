type RuntimeGlobal = typeof globalThis & { process?: { env?: Record<string, string | undefined> } };

const runtimeEnv = (): Record<string, string | undefined> => (globalThis as RuntimeGlobal).process?.env ?? {};

export type ModelProvider = "openai" | "openrouter" | "gemini";

export type ProviderMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

export type ModelProviderClientOptions = Readonly<{
  provider: ModelProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxTokens?: number;
}>;

const BASE_URLS: Readonly<Record<ModelProvider, string>> = Object.freeze({
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com",
});

const required = (value: string | undefined, name: string): string => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name}_NOT_CONFIGURED`);
  return normalized;
};

const normalizeBaseUrl = (provider: ModelProvider, value: string | undefined): string => {
  const configured = (value ?? BASE_URLS[provider]).trim().replace(/\/$/u, "");
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("MODEL_PROVIDER_BASE_URL_INVALID");
  }
  const expected = new URL(BASE_URLS[provider]);
  if (url.protocol !== "https:" || url.origin !== expected.origin || url.pathname.replace(/\/$/u, "") !== expected.pathname.replace(/\/$/u, "")) {
    throw new Error("MODEL_PROVIDER_BASE_URL_FORBIDDEN");
  }
  return url.toString().replace(/\/$/u, "");
};

const boundedTimeout = (value: number | undefined): number => {
  const timeout = Math.floor(value ?? 60_000);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 300_000) throw new Error("MODEL_PROVIDER_TIMEOUT_INVALID");
  return timeout;
};

const boundedTokens = (value: number | undefined): number => {
  const tokens = Math.floor(value ?? 4_096);
  if (!Number.isInteger(tokens) || tokens < 128 || tokens > 32_768) throw new Error("MODEL_PROVIDER_MAX_TOKENS_INVALID");
  return tokens;
};

async function requestWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function openAIContent(data: unknown): string {
  const value = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = value.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("MODEL_PROVIDER_EMPTY_RESPONSE");
  return content;
}

function geminiContent(data: unknown): string {
  const value = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const content = value.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  if (typeof content !== "string" || !content.trim()) throw new Error("MODEL_PROVIDER_EMPTY_RESPONSE");
  return content;
}

export class ModelProviderClient {
  private readonly provider: ModelProvider;
  private readonly model: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;

  constructor(options: ModelProviderClientOptions) {
    this.provider = options.provider;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.provider, options.baseUrl);
    this.timeoutMs = boundedTimeout(options.timeoutMs);
    this.maxTokens = boundedTokens(options.maxTokens);
  }

  async complete(messages: readonly ProviderMessage[]): Promise<string> {
    const env = runtimeEnv();
    const model = required(
      this.model
        ?? (this.provider === "openai" ? env.OPENAI_MODEL : undefined)
        ?? (this.provider === "openrouter" ? (env.OPENROUTER_MODEL ?? env.OPENROUTER_FREE_MODEL) : undefined)
        ?? (this.provider === "gemini" ? env.GEMINI_MODEL : undefined),
      "MODEL_PROVIDER_MODEL",
    );
    const apiKey = required(
      this.apiKey
        ?? (this.provider === "openai" ? env.OPENAI_API_KEY : undefined)
        ?? (this.provider === "openrouter" ? env.OPENROUTER_API_KEY : undefined)
        ?? (this.provider === "gemini" ? env.GEMINI_API_KEY : undefined),
      "MODEL_PROVIDER_API_KEY",
    );

    if (this.provider === "gemini") {
      const system = messages.find((message) => message.role === "system")?.content ?? "";
      const contents = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        }));
      const response = await requestWithTimeout(
        `${this.baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.2, maxOutputTokens: this.maxTokens, responseMimeType: "application/json" },
          }),
        },
        this.timeoutMs,
      );
      if (!response.ok) throw new Error(`MODEL_PROVIDER_HTTP_${response.status}`);
      return geminiContent(await response.json());
    }

    const response = await requestWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          ...(this.provider === "openrouter" ? {
            "HTTP-Referer": env.VITE_SITE_URL ?? "https://flixoai.vercel.app",
            "X-Title": "FLIXO AI Agent Network",
          } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: this.maxTokens,
          response_format: { type: "json_object" },
        }),
      },
      this.timeoutMs,
    );
    if (!response.ok) throw new Error(`MODEL_PROVIDER_HTTP_${response.status}`);
    return openAIContent(await response.json());
  }
}
