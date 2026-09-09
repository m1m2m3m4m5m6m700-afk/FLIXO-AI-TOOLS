import { z } from 'zod';
import { planFromIntent } from '@/lib/ai/planner';
import { parseExecutionPlan, safeParseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan';

const ProviderMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().max(32_000),
}).strict();

export const LLMProviderRequestSchema = z.object({
  messages: z.array(ProviderMessageSchema).min(1).max(32),
  maxTokens: z.number().int().positive().max(16_384).optional(),
}).strict();

export type LLMProviderRequest = z.infer<typeof LLMProviderRequestSchema>;

export const LLMUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().finite().nonnegative().optional(),
}).strict();

const FunctionCallSchema = z.object({
  name: z.string().min(1).max(128),
  arguments: z.union([z.string().max(64_000), z.record(z.string(), z.unknown())]),
}).strict();

export const LLMProviderResponseSchema = z.object({
  functionCall: FunctionCallSchema,
  model: z.string().min(1).max(256).optional(),
  usage: LLMUsageSchema.optional(),
}).strict();

export type LLMProviderResponse = z.infer<typeof LLMProviderResponseSchema>;
export type LLMProvider = (request: LLMProviderRequest, signal: AbortSignal) => Promise<LLMProviderResponse>;

export type ProviderFailureCode =
  | 'INVALID_REQUEST'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'RATE_LIMITED'
  | 'MALFORMED_RESPONSE'
  | 'UNSUPPORTED_FUNCTION'
  | 'INVALID_PLAN'
  | 'RETRY_EXHAUSTED';

export class LLMProviderError extends Error {
  readonly code: ProviderFailureCode;
  readonly cause?: unknown;
  readonly status?: number;
  readonly attempts?: number;

  constructor(code: ProviderFailureCode, message: string, cause?: unknown, status?: number, attempts?: number) {
    super(message);
    this.name = 'LLMProviderError';
    this.code = code;
    this.cause = cause;
    this.status = status;
    this.attempts = attempts;
  }
}

export const EXECUTION_PLAN_FUNCTION_NAME = 'propose_execution_plan';

export const EXECUTION_PLAN_FUNCTION_CONTRACT = Object.freeze({
  name: EXECUTION_PLAN_FUNCTION_NAME,
  version: '1',
  description: 'Propose a validated FLIXO execution plan. The provider never executes tools.',
});

function parseFunctionArguments(value: string | Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new LLMProviderError('MALFORMED_RESPONSE', 'Provider function arguments are not valid JSON.', error);
  }
}

export function parseProviderExecutionPlan(response: unknown): ExecutionPlanContract {
  const parsed = LLMProviderResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new LLMProviderError('MALFORMED_RESPONSE', 'Provider response does not match the normalized contract.', parsed.error);
  }
  if (parsed.data.functionCall.name !== EXECUTION_PLAN_FUNCTION_NAME) {
    throw new LLMProviderError('UNSUPPORTED_FUNCTION', `Provider proposed unsupported function '${parsed.data.functionCall.name}'.`);
  }

  try {
    return parseExecutionPlan(parseFunctionArguments(parsed.data.functionCall.arguments));
  } catch (error) {
    if (error instanceof LLMProviderError) throw error;
    throw new LLMProviderError('INVALID_PLAN', 'Provider proposed an execution plan rejected by the canonical capability contract.', error);
  }
}

function planLocally(input: string): ExecutionPlanContract | null {
  const candidate = planFromIntent(input);
  if (!candidate) return null;
  const parsed = safeParseExecutionPlan(candidate);
  return parsed.success ? parsed.data : null;
}

export type ProviderExecutionResult = Readonly<{
  plan: ExecutionPlanContract;
  latencyMs: number;
  attempts: number;
  model?: string;
  usage?: z.infer<typeof LLMUsageSchema>;
}>;

export type ProviderOrLocalResult = Readonly<{
  plan: ExecutionPlanContract | null;
  source: 'provider' | 'local';
  latencyMs: number;
  attempts: number;
  model?: string;
  usage?: z.infer<typeof LLMUsageSchema>;
  providerFailure?: LLMProviderError;
}>;

function validateRetryOptions(maxRetries: number, retryBaseDelayMs: number, maxRetryDelayMs: number): void {
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) {
    throw new LLMProviderError('INVALID_REQUEST', 'Provider maxRetries must be an integer between 0 and 3.');
  }
  if (!Number.isInteger(retryBaseDelayMs) || retryBaseDelayMs < 0 || retryBaseDelayMs > 5_000) {
    throw new LLMProviderError('INVALID_REQUEST', 'Provider retryBaseDelayMs must be an integer between 0ms and 5000ms.');
  }
  if (!Number.isInteger(maxRetryDelayMs) || maxRetryDelayMs < 0 || maxRetryDelayMs > 30_000) {
    throw new LLMProviderError('INVALID_REQUEST', 'Provider maxRetryDelayMs must be an integer between 0ms and 30000ms.');
  }
}

async function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    }, { once: true });
  });
}

export async function planFromProvider(
  provider: LLMProvider,
  input: string,
  options: {
    timeoutMs?: number;
    maxTokens?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
    maxRetryDelayMs?: number;
  } = {},
): Promise<ProviderExecutionResult> {
  const request = LLMProviderRequestSchema.parse({
    messages: [{ role: 'user', content: input }],
    maxTokens: options.maxTokens,
  });
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRetries = options.maxRetries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 100;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 2_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new LLMProviderError('INVALID_REQUEST', 'Provider timeout must be an integer between 1ms and 120000ms.');
  }
  validateRetryOptions(maxRetries, retryBaseDelayMs, maxRetryDelayMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  let attempts = 0;
  try {
    for (;;) {
      attempts += 1;
      try {
        const response = await provider(request, controller.signal);
        const plan = parseProviderExecutionPlan(response);
        return Object.freeze({
          plan,
          latencyMs: Math.max(0, Math.round(performance.now() - started)),
          attempts,
          model: response.model,
          usage: response.usage,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new LLMProviderError('TIMEOUT', `LLM provider timed out after ${timeoutMs}ms.`, error, undefined, attempts);
        }
        if (error instanceof LLMProviderError && !['HTTP_ERROR', 'RATE_LIMITED'].includes(error.code)) {
          throw error;
        }
        if (attempts > maxRetries) {
          throw error instanceof LLMProviderError
            ? new LLMProviderError('RETRY_EXHAUSTED', `LLM provider failed after ${attempts} attempts.`, error, error.status, attempts)
            : new LLMProviderError('RETRY_EXHAUSTED', `LLM provider failed after ${attempts} attempts.`, error, undefined, attempts);
        }
        const delay = Math.min(maxRetryDelayMs, retryBaseDelayMs * 2 ** (attempts - 1));
        await abortableDelay(delay, controller.signal);
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function planWithProviderOrLocal(
  provider: LLMProvider | undefined,
  input: string,
  options: {
    timeoutMs?: number;
    maxTokens?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
    maxRetryDelayMs?: number;
  } = {},
): Promise<ProviderOrLocalResult> {
  if (!provider) {
    return Object.freeze({
      plan: planLocally(input),
      source: 'local',
      latencyMs: 0,
      attempts: 0,
    });
  }
  const started = performance.now();
  try {
    const result = await planFromProvider(provider, input, options);
    return Object.freeze({
      plan: result.plan,
      source: 'provider',
      latencyMs: result.latencyMs,
      attempts: result.attempts,
      model: result.model,
      usage: result.usage,
    });
  } catch (error) {
    const providerFailure = error instanceof LLMProviderError
      ? error
      : new LLMProviderError('HTTP_ERROR', 'Unexpected LLM provider failure.', error);
    return Object.freeze({
      plan: planLocally(input),
      source: 'local',
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      attempts: providerFailure.attempts ?? 1,
      providerFailure,
    });
  }
}

export type GatewayLLMProviderOptions = Readonly<{
  endpoint: string;
  fetchImpl?: typeof fetch;
  headers?: Readonly<Record<string, string>>;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  maxRetryDelayMs?: number;
}>;

export function createGatewayLLMProvider(options: GatewayLLMProviderOptions): LLMProvider {
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== 'https:') {
    throw new LLMProviderError('INVALID_REQUEST', 'LLM gateway endpoint must use HTTPS.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 100;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 2_000;
  validateRetryOptions(maxRetries, retryBaseDelayMs, maxRetryDelayMs);

  return async (request, signal) => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify({
        ...request,
        contract: EXECUTION_PLAN_FUNCTION_CONTRACT,
      }),
      signal,
    });
    if (!response.ok) {
      if (response.status === 429) {
        throw new LLMProviderError('RATE_LIMITED', 'LLM gateway rate limit exceeded.', undefined, response.status);
      }
      throw new LLMProviderError('HTTP_ERROR', `LLM gateway returned HTTP ${response.status}.`, undefined, response.status);
    }
    const raw: unknown = await response.json();
    const parsed = LLMProviderResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new LLMProviderError('MALFORMED_RESPONSE', 'LLM gateway returned a malformed normalized response.', parsed.error);
    }
    return parsed.data;
  };
}
