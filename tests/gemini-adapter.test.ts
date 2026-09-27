import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GeminiAdapter, GeminiAdapterError } from '../src/lib/agent/gemini-adapter.ts';
import type { LLMToolSpec } from '../src/lib/agent/base.ts';

const tool: LLMToolSpec = {
  name: 'resize',
  description: 'Resize an image.',
  parameters: {
    type: 'object',
    properties: { width: { type: 'integer' } },
    required: ['width'],
    additionalProperties: false,
  },
};

function sse(lines: string[]): Response {
  return new Response(lines.join('\n') + '\n', {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

test('Gemini adapter sends system instruction, tools, config and API key header', async () => {
  let request: RequestInit | undefined;
  let url = '';
  const adapter = new GeminiAdapter({
    apiKey: 'secret',
    defaultModel: 'gemini-test',
    fetchImpl: async (input, init) => {
      url = String(input);
      request = init;
      return sse([
        'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}',
        'data: [DONE]',
      ]);
    },
  });

  const chunks = [];
  for await (const chunk of adapter.streamChat(
    [
      { role: 'system', content: 'You are FLIXO.' },
      { role: 'user', content: 'Resize it.' },
    ],
    [tool],
    { temperature: 0.3, maxTokens: 100, requestId: 'req-1', traceId: 'trace-1' },
  )) {
    chunks.push(chunk);
  }

  assert.match(url, /models\/gemini-test:streamGenerateContent\?alt=sse$/);
  assert.equal((request?.headers as Record<string, string>)['x-goog-api-key'], 'secret');
  assert.equal((request?.headers as Record<string, string>)['x-flixo-request-id'], 'req-1');
  const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
  assert.deepEqual(body.systemInstruction, { parts: [{ text: 'You are FLIXO.' }] });
  assert.deepEqual(body.tools, [{ functionDeclarations: [tool] }]);
  assert.deepEqual(body.generationConfig, { temperature: 0.3, maxOutputTokens: 100 });
  assert.deepEqual(chunks, [{ type: 'token', content: 'ok' }]);
});

test('Gemini adapter normalizes function calls into validated start/end chunks', async () => {
  const adapter = new GeminiAdapter({
    apiKey: 'secret',
    fetchImpl: async () => sse([
      'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"resize","args":{"width":800}}}]}}]}',
    ]),
  });

  const chunks = [];
  for await (const chunk of adapter.streamChat([{ role: 'user', content: 'resize' }], [tool])) {
    chunks.push(chunk);
  }

  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0], {
    type: 'tool_call_start',
    toolCall: { id: 'gemini-call-1', name: 'resize', args: { width: 800 } },
  });
  assert.deepEqual(chunks[1], {
    type: 'tool_call_end',
    toolCall: { id: 'gemini-call-1', name: 'resize', args: { width: 800 } },
  });
});

test('Gemini adapter blocks missing credentials before issuing network requests', async () => {
  let called = false;
  const adapter = new GeminiAdapter({
    apiKey: '',
    fetchImpl: async () => {
      called = true;
      return sse([]);
    },
  });

  await assert.rejects(
    async () => {
      for await (const chunk of adapter.streamChat([{ role: 'user', content: 'hello' }], [])) {
        void chunk;
      }
    },
    (error: unknown) => error instanceof GeminiAdapterError && /API key missing/.test(error.message),
  );
  assert.equal(called, false);
});

test('Gemini adapter propagates AbortSignal to fetch', async () => {
  let receivedSignal: AbortSignal | undefined;
  const adapter = new GeminiAdapter({
    apiKey: 'secret',
    fetchImpl: async (_input, init) => {
      receivedSignal = init?.signal as AbortSignal | undefined;
      return sse(['data: {"candidates":[]}']);
    },
  });
  const controller = new AbortController();

  for await (const chunk of adapter.streamChat(
    [{ role: 'user', content: 'hello' }],
    [],
    { signal: controller.signal },
  )) {
    void chunk;
  }

  assert.equal(receivedSignal, controller.signal);
});