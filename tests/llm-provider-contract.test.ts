import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';

import {
  LLMProviderContractError,
  LLMProviderOptionsSchema,
  LLMToolSpecListSchema,
  StreamChunkSchema,
  createLLMToolSpec,
  createValidatedLLMProvider,
  parseLLMMessages,
  parseLLMProviderOptions,
  parseLLMTools,
  parseStreamChunk,
  validateStreamChunk,
  type LLMProvider,
} from '../src/lib/agent/llm-provider-contract.ts';

const tools = [
  {
    name: 'resize',
    description: 'Resize an image.',
    parameters: {
      type: 'object',
      properties: {
        width: { type: 'integer' },
      },
      required: ['width'],
      additionalProperties: false,
    },
  },
];

test('LLM contract validates messages, tools and runtime options', () => {
  const messages = parseLLMMessages([
    { role: 'system', content: 'You are FLIXO.' },
    { role: 'user', content: 'Resize it.' },
    { role: 'assistant', content: '', name: 'agent' },
    { role: 'tool', content: '{"width":800}', toolCallId: 'call-1' },
  ]);

  assert.equal(messages.length, 4);
  assert.deepEqual(parseLLMTools(tools), tools);
  assert.equal(parseLLMProviderOptions({ temperature: 0.2, maxTokens: 2048 }).temperature, 0.2);
  assert.throws(
    () => parseLLMMessages([{ role: 'tool', content: 'missing id' }]),
    (error: unknown) => error instanceof LLMProviderContractError && error.code === 'INVALID_MESSAGE',
  );
});


test('creates an LLM tool spec directly from a Zod parameter schema', () => {
  assert.deepEqual(
    createLLMToolSpec(
      'resize',
      'Resize an image.',
      z.object({ width: z.number().int().positive() }).strict(),
    ),
    {
      name: 'resize',
      description: 'Resize an image.',
      parameters: {
        type: 'object',
        properties: { width: { type: 'integer', minimum: 0 } },
        required: ['width'],
        additionalProperties: false,
      },
    },
  );
});

test('stream chunks are discriminated and reject malformed events', () => {
  assert.deepEqual(
    parseStreamChunk({ type: 'token', content: 'hello' }),
    { type: 'token', content: 'hello' },
  );

  assert.equal(
    StreamChunkSchema.safeParse({
      type: 'tool_call_start',
      toolCall: { id: 'call-1', name: 'resize', args: { width: 800 } },
    }).success,
    true,
  );

  assert.throws(
    () => parseStreamChunk({ type: 'error', content: 'wrong field' }),
    (error: unknown) => error instanceof LLMProviderContractError && error.code === 'INVALID_STREAM_CHUNK',
  );
});

test('tool calls are bounded to declared tools and optional Zod validators', () => {
  const validators = {
    resize: z.object({ width: z.number().int().positive() }).passthrough() as z.ZodType<Record<string, unknown>>,
  };

  assert.doesNotThrow(() => validateStreamChunk(
    { type: 'tool_call_end', toolCall: { id: 'call-1', name: 'resize', args: { width: 800 } } },
    tools,
    validators,
  ));

  assert.throws(
    () => validateStreamChunk(
      { type: 'tool_call_end', toolCall: { id: 'call-2', name: 'crop', args: {} } },
      tools,
    ),
    (error: unknown) => error instanceof LLMProviderContractError && error.code === 'UNKNOWN_TOOL_CALL',
  );

  assert.throws(
    () => validateStreamChunk(
      { type: 'tool_call_end', toolCall: { id: 'call-3', name: 'resize', args: { width: -1 } } },
      tools,
      validators,
    ),
    (error: unknown) => error instanceof LLMProviderContractError && error.code === 'INVALID_TOOL_ARGS',
  );
});

test('validated provider enforces the contract at its boundary', async () => {
  const baseProvider: LLMProvider = {
    providerName: 'test-provider',
    async *streamChat() {
      yield { type: 'tool_call_start', toolCall: { id: 'call-1', name: 'resize', args: { width: 800 } } };
      yield { type: 'tool_call_end', toolCall: { id: 'call-1', name: 'resize', args: { width: 800 } } };
    },
  };

  const provider = createValidatedLLMProvider(baseProvider);
  const chunks = [];
  for await (const chunk of provider.streamChat(
    [{ role: 'user', content: 'resize' }],
    tools,
    { requestId: 'req-1', traceId: 'trace-1' },
  )) {
    chunks.push(chunk);
  }

  assert.equal(provider.providerName, 'test-provider');
  assert.equal(chunks.length, 2);
  assert.equal(chunks[1]?.type, 'tool_call_end');
});

test('validated provider propagates provider abort signals without mutating the options contract', async () => {
  let receivedSignal: AbortSignal | undefined;

  const baseProvider: LLMProvider = {
    providerName: 'abort-test',
    async *streamChat(_messages, _tools, options) {
      receivedSignal = options?.signal;
      yield { type: 'token', content: 'ok' };
    },
  };

  const controller = new AbortController();
  const provider = createValidatedLLMProvider(baseProvider);
  const iterator = provider.streamChat(
    [{ role: 'user', content: 'hello' }],
    tools,
    { signal: controller.signal },
  );
  await iterator.next();

  assert.equal(receivedSignal, controller.signal);
});

test('option and tool schemas reject non-contract values', () => {
  assert.equal(LLMProviderOptionsSchema.safeParse({ temperature: 3 }).success, false);
  assert.equal(LLMToolSpecListSchema.safeParse([{ name: '', description: '', parameters: {} }]).success, false);
});
