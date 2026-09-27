import { z } from 'zod';
import { zodToJsonSchema, type JsonValue } from './zod-json-schema.ts';

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';
export type Role = LLMRole;

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(JsonValueSchema),
  z.record(z.string(), JsonValueSchema),
]));
const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
export type JsonObject = Record<string, JsonValue>;

const LLMMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().max(32_000),
  name: z.string().min(1).max(128).optional(),
  toolCallId: z.string().min(1).max(256).optional(),
}).strict().superRefine((message, ctx) => {
  if (message.role === 'tool' && !message.toolCallId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['toolCallId'],
      message: 'Tool messages require toolCallId.',
    });
  }
});

export type LLMMessage = z.infer<typeof LLMMessageSchema>;
export const LLMMessageListSchema = z.array(LLMMessageSchema).min(1).max(128);

const LLMToolSpecSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(8_000),
  parameters: JsonObjectSchema,
}).strict();

export type LLMToolSpec = z.infer<typeof LLMToolSpecSchema>;
export const LLMToolSpecListSchema = z.array(LLMToolSpecSchema).max(256);

export function createLLMToolSpec(
  name: string,
  description: string,
  parameters: z.ZodTypeAny,
): LLMToolSpec {
  return { name, description, parameters: zodToJsonSchema(parameters) };
}

const ToolCallSchema = z.object({
  id: z.string().min(1).max(256),
  name: z.string().min(1).max(128),
  args: JsonObjectSchema,
}).strict();

export type LLMToolCall = z.infer<typeof ToolCallSchema>;

export const StreamChunkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('token'),
    content: z.string().max(64_000),
  }).strict(),
  z.object({
    type: z.literal('tool_call_start'),
    toolCall: ToolCallSchema,
  }).strict(),
  z.object({
    type: z.literal('tool_call_end'),
    toolCall: ToolCallSchema,
  }).strict(),
  z.object({
    type: z.literal('error'),
    error: z.string().min(1).max(8_000),
  }).strict(),
]);

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

const LLMProviderOptionsShape = {
  model: z.string().min(1).max(256).optional(),
  temperature: z.number().finite().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(128_000).optional(),
  requestId: z.string().min(1).max(256).optional(),
  traceId: z.string().min(1).max(256).optional(),
  signal: z.custom<AbortSignal>(
    (value) => value === undefined || (
      typeof value === 'object' &&
      value !== null &&
      'aborted' in value &&
      typeof (value as { aborted?: unknown }).aborted === 'boolean'
    ),
    'Expected an AbortSignal-like object.',
  ).optional(),
};

export const LLMProviderOptionsSchema = z.object(LLMProviderOptionsShape).strict();
export type LLMProviderOptions = z.infer<typeof LLMProviderOptionsSchema>;

export type LLMToolArgumentValidator = z.ZodType<Record<string, unknown>>;

export type LLMProvider = {
  readonly providerName: string;
  streamChat(
    messages: readonly LLMMessage[],
    tools: readonly LLMToolSpec[],
    options?: LLMProviderOptions,
  ): AsyncGenerator<StreamChunk, void, unknown>;
};

export type LLMProviderContractErrorCode =
  | 'INVALID_MESSAGE'
  | 'INVALID_TOOL_SPEC'
  | 'INVALID_OPTIONS'
  | 'INVALID_STREAM_CHUNK'
  | 'UNKNOWN_TOOL_CALL'
  | 'INVALID_TOOL_ARGS';

export class LLMProviderContractError extends Error {
  readonly code: LLMProviderContractErrorCode;
  readonly cause?: unknown;

  constructor(code: LLMProviderContractErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'LLMProviderContractError';
    this.code = code;
    this.cause = cause;
  }
}

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  code: LLMProviderContractErrorCode,
  message: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new LLMProviderContractError(code, message, result.error);
  }
  return result.data;
}

export function parseLLMMessages(value: unknown): LLMMessage[] {
  return parseOrThrow(LLMMessageListSchema, value, 'INVALID_MESSAGE', 'LLM messages do not satisfy the runtime contract.');
}

export function parseLLMTools(value: unknown): LLMToolSpec[] {
  return parseOrThrow(LLMToolSpecListSchema, value, 'INVALID_TOOL_SPEC', 'LLM tool specifications do not satisfy the runtime contract.');
}

export function parseLLMProviderOptions(value: unknown): LLMProviderOptions {
  return parseOrThrow(LLMProviderOptionsSchema, value ?? {}, 'INVALID_OPTIONS', 'LLM provider options do not satisfy the runtime contract.');
}

export function parseStreamChunk(value: unknown): StreamChunk {
  return parseOrThrow(StreamChunkSchema, value, 'INVALID_STREAM_CHUNK', 'LLM provider emitted a stream chunk that does not satisfy the runtime contract.');
}

export function validateToolCall(
  toolCall: LLMToolCall,
  tools: readonly LLMToolSpec[],
  validators: Readonly<Record<string, LLMToolArgumentValidator>> = {},
): LLMToolCall {
  if (!tools.some((tool) => tool.name === toolCall.name)) {
    throw new LLMProviderContractError(
      'UNKNOWN_TOOL_CALL',
      'LLM provider emitted an unknown tool call: ' + toolCall.name + '.',
    );
  }

  const validator = validators[toolCall.name];
  if (validator) {
    const result = validator.safeParse(toolCall.args);
    if (!result.success) {
      throw new LLMProviderContractError(
        'INVALID_TOOL_ARGS',
        'LLM provider emitted invalid arguments for tool: ' + toolCall.name + '.',
        result.error,
      );
    }
  }

  return toolCall;
}

export function validateStreamChunk(
  value: unknown,
  tools: readonly LLMToolSpec[] = [],
  validators: Readonly<Record<string, LLMToolArgumentValidator>> = {},
): StreamChunk {
  const chunk = parseStreamChunk(value);
  if (chunk.type === 'tool_call_start' || chunk.type === 'tool_call_end') {
    validateToolCall(chunk.toolCall, tools, validators);
  }
  return chunk;
}

export function createValidatedLLMProvider(
  provider: LLMProvider,
  options: {
    readonly toolArgumentValidators?: Readonly<Record<string, LLMToolArgumentValidator>>;
  } = {},
): LLMProvider {
  const validators = options.toolArgumentValidators ?? {};

  return {
    providerName: provider.providerName,
    async *streamChat(messages, tools, providerOptions) {
      const validatedMessages = parseLLMMessages(messages);
      const validatedTools = parseLLMTools(tools);
      const validatedOptions = parseLLMProviderOptions(providerOptions);
      const stream = provider.streamChat(validatedMessages, validatedTools, validatedOptions);
      for await (const value of stream) {
        yield validateStreamChunk(value, validatedTools, validators);
      }
    },
  };
}
