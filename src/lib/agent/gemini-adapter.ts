import {
  createValidatedLLMProvider,
  type LLMMessage,
  type LLMProvider,
  type LLMProviderOptions,
  type LLMToolSpec,
  type StreamChunk,
} from './base.ts';

const DEFAULT_MODEL = 'gemini-3.8-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiAdapterError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GeminiAdapterError';
    this.status = status;
  }
}

export type GeminiAdapterOptions = Readonly<{
  apiKey?: string;
  fetchImpl?: typeof fetch;
  defaultModel?: string;
  validateStream?: boolean;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseToolResponse(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    if (isRecord(parsed)) return parsed;
  } catch {}
  return { result: content };
}

function mapMessages(messages: readonly LLMMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }>;
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join('\n\n');

  const contents = messages.filter((m) => m.role !== 'system').map((m) => {
    if (m.role === 'tool') {
      if (!m.name) throw new GeminiAdapterError('Gemini tool messages require a tool name.');
      return {
        role: 'user' as const,
        parts: [{ functionResponse: { name: m.name, response: parseToolResponse(m.content) } }],
      };
    }
    return {
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    };
  });

  return system
    ? { systemInstruction: { parts: [{ text: system }] }, contents }
    : { contents };
}

function parseSseData(line: string): unknown | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload) as unknown;
  } catch (error) {
    throw new GeminiAdapterError(
      error instanceof Error ? `Gemini returned invalid SSE JSON: ${error.message}` : 'Gemini returned invalid SSE JSON.',
    );
  }
}

function candidatesOf(value: unknown): Array<Record<string, unknown>> {
  if (!isRecord(value) || !Array.isArray(value.candidates)) return [];
  return value.candidates.filter(isRecord);
}

function partsOf(candidate: Record<string, unknown>): Array<Record<string, unknown>> {
  const content = candidate.content;
  if (!isRecord(content) || !Array.isArray(content.parts)) return [];
  return content.parts.filter(isRecord);
}

export class GeminiAdapter implements LLMProvider {
  readonly providerName = 'gemini';
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultModel: string;
  private readonly validateStream: boolean;

  constructor(options: GeminiAdapterOptions | string = {}) {
    if (typeof options === 'string') {
      this.apiKey = options;
      this.fetchImpl = fetch;
      this.defaultModel = DEFAULT_MODEL;
      this.validateStream = true;
      return;
    }
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.validateStream = options.validateStream ?? true;
  }

  streamChat(
    messages: readonly LLMMessage[],
    tools: readonly LLMToolSpec[],
    options?: LLMProviderOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const rawProvider: LLMProvider = {
      providerName: this.providerName,
      streamChat: (inputMessages, inputTools, inputOptions) =>
        this.streamFromGemini(inputMessages, inputTools, inputOptions),
    };
    const provider = this.validateStream ? createValidatedLLMProvider(rawProvider) : rawProvider;
    return provider.streamChat(messages, tools, options);
  }

  private async *streamFromGemini(
    messages: readonly LLMMessage[],
    tools: readonly LLMToolSpec[],
    options?: LLMProviderOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.apiKey) throw new GeminiAdapterError('Gemini API key missing.');

    const model = options?.model ?? this.defaultModel;
    const endpoint = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const mapped = mapMessages(messages);
    const body = {
      ...mapped,
      ...(tools.length ? { tools: [{ functionDeclarations: tools }] } : {}),
      ...(options?.temperature !== undefined || options?.maxTokens !== undefined
        ? { generationConfig: {
            ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
            ...(options?.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {}),
          } }
        : {}),
    };

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
        ...(options?.requestId ? { 'x-flixo-request-id': options.requestId } : {}),
        ...(options?.traceId ? { 'x-flixo-trace-id': options.traceId } : {}),
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok || !response.body) {
      let detail = response.statusText;
      try {
        const payload: unknown = await response.json();
        if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
          detail = payload.error.message;
        }
      } catch {}
      throw new GeminiAdapterError(`Gemini API error ${response.status}: ${detail}`, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sequence = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const payload = parseSseData(line);
          if (payload === null) continue;
          for (const candidate of candidatesOf(payload)) {
            for (const part of partsOf(candidate)) {
              if (typeof part.text === 'string' && part.text.length > 0) {
                yield { type: 'token', content: part.text };
              }
              const call = part.functionCall;
              if (!isRecord(call) || typeof call.name !== 'string' || !call.name) continue;
              sequence += 1;
              const toolCall = {
                id: `gemini-call-${sequence}`,
                name: call.name,
                args: isRecord(call.args) ? call.args : {},
              };
              yield { type: 'tool_call_start', toolCall };
              yield { type: 'tool_call_end', toolCall };
            }
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        const payload = parseSseData(buffer);
        if (payload !== null) {
          for (const candidate of candidatesOf(payload)) {
            for (const part of partsOf(candidate)) {
              if (typeof part.text === 'string' && part.text.length > 0) {
                yield { type: 'token', content: part.text };
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}