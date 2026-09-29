export const LLM_PROVIDER_NAMES = ["openai", "anthropic", "gemini"] as const;
export type LLMProviderName = (typeof LLM_PROVIDER_NAMES)[number];

export type LLMMessageRole = "system" | "user" | "assistant" | "tool";

export type LLMToolDefinition = Readonly<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}>;

export type LLMToolCall = Readonly<{
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}>;

export type LLMToolResult = Readonly<{
  callId: string;
  toolName: string;
  result: Record<string, unknown>;
  isError: boolean;
}>;

export type LLMMessage = Readonly<{
  role: LLMMessageRole;
  content: string;
  toolCalls?: readonly LLMToolCall[];
  toolResults?: readonly LLMToolResult[];
}>;

export type LLMStreamEvent =
  | Readonly<{ type: "text_delta"; text: string }>
  | Readonly<{ type: "turn_end"; toolCalls: readonly LLMToolCall[] }>;

export type LLMStreamRequest = Readonly<{
  model: string;
  systemPrompt: string;
  messages: readonly LLMMessage[];
  tools: readonly LLMToolDefinition[];
  signal?: AbortSignal;
  resumePrefix?: string;
}>;

export interface LLMProvider {
  readonly name: LLMProviderName;
  readonly model: string;
  isConfigured(): boolean;
  stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent>;
}

export class LLMProviderError extends Error {
  readonly provider: LLMProviderName;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    provider: LLMProviderName,
    message: string,
    options: { status?: number; retryable: boolean } = { retryable: true },
  ) {
    super(message);
    this.name = "LLMProviderError";
    this.provider = provider;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

export class LLMUnavailableError extends Error {
  constructor(message = "No configured LLM provider is currently available.") {
    super(message);
    this.name = "LLMUnavailableError";
  }
}
