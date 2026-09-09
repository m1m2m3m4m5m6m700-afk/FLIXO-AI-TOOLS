import assert from 'node:assert/strict';
import {
  EXECUTION_PLAN_FUNCTION_NAME,
  LLMProviderError,
  parseProviderExecutionPlan,
  planFromProvider,
  planWithProviderOrLocal,
} from '../src/lib/agent/llm-provider.ts';

const validResponse = {
  functionCall: {
    name: EXECUTION_PLAN_FUNCTION_NAME,
    arguments: JSON.stringify({
      workflowName: 'Compress and convert',
      confidence: 0.94,
      steps: [
        { toolId: 'image-converter', params: { format: 'image/webp' } },
        { toolId: 'image-compressor', params: { targetSizeKB: 200 } },
      ],
    }),
  },
  model: 'gateway-test',
  usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50, costUsd: 0.001 },
};

const plan = parseProviderExecutionPlan(validResponse);
assert.deepEqual(plan.steps, validResponse.functionCall && JSON.parse(validResponse.functionCall.arguments).steps);

assert.throws(
  () => parseProviderExecutionPlan({ ...validResponse, functionCall: { ...validResponse.functionCall, name: 'execute_anything' } }),
  (error) => error instanceof LLMProviderError && error.code === 'UNSUPPORTED_FUNCTION',
);

assert.throws(
  () => parseProviderExecutionPlan({
    ...validResponse,
    functionCall: { ...validResponse.functionCall, arguments: JSON.stringify({ workflowName: 'Hallucinated', confidence: 0.9, steps: [{ toolId: 'unknown-tool', params: {} }] }) },
  }),
  (error) => error instanceof LLMProviderError && error.code === 'INVALID_PLAN',
);

assert.throws(
  () => parseProviderExecutionPlan({ ...validResponse, functionCall: { ...validResponse.functionCall, arguments: '{broken' } }),
  (error) => error instanceof LLMProviderError && error.code === 'MALFORMED_RESPONSE',
);

const provider = async () => validResponse;
const result = await planFromProvider(provider, 'compress this image and convert to WebP', { timeoutMs: 1_000 });
assert.equal(result.plan.steps.length, 2);
assert.equal(result.model, 'gateway-test');
assert.equal(result.usage?.totalTokens, 50);
assert.equal(typeof result.latencyMs, 'number');

const timeoutProvider = async (_request, signal) => await new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
});
await assert.rejects(
  () => planFromProvider(timeoutProvider, 'test timeout', { timeoutMs: 5 }),
  (error) => error instanceof LLMProviderError && error.code === 'TIMEOUT',
);

const fallback = await planWithProviderOrLocal(async () => { throw new Error('gateway unavailable'); }, 'compress this image under 200KB and convert to WebP');
assert.equal(fallback.source, 'local');
assert.ok(fallback.plan);
assert.equal(fallback.providerFailure?.code, 'HTTP_ERROR');

const noProvider = await planWithProviderOrLocal(undefined, 'compress this image under 200KB and convert to WebP');
assert.equal(noProvider.source, 'local');
assert.ok(noProvider.plan);

console.log('P3 LLM provider boundary contract tests passed.');
