import assert from 'node:assert/strict';
import {
  createGatewayLLMProvider,
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
assert.deepEqual(plan.steps, JSON.parse(validResponse.functionCall.arguments).steps);

const objectArgumentPlan = parseProviderExecutionPlan({
  ...validResponse,
  functionCall: {
    ...validResponse.functionCall,
    arguments: JSON.parse(validResponse.functionCall.arguments),
  },
});
assert.deepEqual(objectArgumentPlan.steps, plan.steps);

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

assert.throws(
  () => createGatewayLLMProvider({ endpoint: 'http://gateway.example.test/v1/plan' }),
  (error) => error instanceof LLMProviderError && error.code === 'INVALID_REQUEST',
);

const gatewayCalls = [];
const gatewayProvider = createGatewayLLMProvider({
  endpoint: 'https://gateway.example.test/v1/plan',
  fetchImpl: async (input, init) => {
    gatewayCalls.push({ input: String(input), init });
    return new Response(JSON.stringify(validResponse), { status: 200, headers: { 'content-type': 'application/json' } });
  },
  headers: { authorization: 'Bearer test-token' },
});
const gatewayResult = await planFromProvider(gatewayProvider, 'compress this image', { timeoutMs: 1_000 });
assert.equal(gatewayResult.plan.steps.length, 2);
assert.equal(gatewayCalls.length, 1);
assert.equal(gatewayCalls[0].init.method, 'POST');
assert.equal(gatewayCalls[0].init.headers.authorization, 'Bearer test-token');
assert.equal(JSON.parse(gatewayCalls[0].init.body).contract.name, EXECUTION_PLAN_FUNCTION_NAME);

console.log('P3 LLM provider boundary contract tests passed.');
