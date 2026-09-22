import type { IncomingMessage, ServerResponse } from 'node:http';
import { getCapability, getExecutableCapabilityIds } from '../src/lib/agent/capability-registry.ts';
import { parseAgentDecision, parseAgentRequest, type AgentRequestContract } from '../src/lib/contracts/agent-gateway.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { buildFlixoAgentMasterPrompt } from '../src/lib/agent/flixo-agent-master-prompt.ts';

const MAX_MESSAGES = 24;
const MAX_REQUEST_BODY_BYTES = 512 * 1024;
const MAX_PROVIDER_CALLS = 2;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 900;
const MAX_RESPONSE_TOKENS = 4_096;
const SUPPORTED_PROVIDERS = ['openai', 'openrouter', 'gemini'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error('Invalid FLIXO AI runtime configuration.');
  }
  return parsed;
}

function resolveProvider(value: string | undefined, fallback = 'openai'): SupportedProvider {
  const normalized = (value ?? fallback).trim().toLocaleLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(normalized as SupportedProvider)) {
    throw new Error('Unsupported FLIXO AI provider configuration.');
  }
  return normalized as SupportedProvider;
}

function configuredRuntime(): {
  provider: SupportedProvider;
  fallbackProvider: SupportedProvider | null;
  timeoutMs: number;
  maxTokens: number;
} {
  const provider = resolveProvider(process.env.FLIXO_AI_PROVIDER);
  const configuredFallback = process.env.FLIXO_AI_FALLBACK_PROVIDER;
  const fallbackProvider = configuredFallback?.trim()
    ? resolveProvider(configuredFallback, provider)
    : null;
  if (fallbackProvider === provider) {
    throw new Error('Invalid FLIXO AI fallback configuration.');
  }
  return {
    provider,
    fallbackProvider,
    timeoutMs: parseBoundedInteger(process.env.FLIXO_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 250, MAX_TIMEOUT_MS),
    maxTokens: parseBoundedInteger(
      process.env.FLIXO_AI_DEFAULT_MAX_TOKENS,
      DEFAULT_MAX_TOKENS,
      128,
      MAX_RESPONSE_TOKENS,
    ),
  };
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('AI provider request timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<AgentRequestContract> {
  const contentLength = req.headers['content-length'];
  if (contentLength !== undefined) {
    const declaredLength = Number(Array.isArray(contentLength) ? contentLength[0] : contentLength);
    if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_REQUEST_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
  }

  let raw = '';
  let bytes = 0;
  for await (const chunk of req) {
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_REQUEST_BODY_BYTES) throw new Error('Request body is too large.');
    raw += text;
  }
  return parseAgentRequest(JSON.parse(raw));
}

function executableCatalog(): Array<Record<string, unknown>> {
  return getExecutableCapabilityIds().map((id) => {
    const capability = getCapability(id);
    if (!capability) return null;
    const schema = capability.parameterSchema as { shape?: Record<string, unknown> };
    return {
      id,
      title: capability.title,
      description: capability.description,
      intents: capability.intents,
      parameterNames: schema.shape ? Object.keys(schema.shape) : ['tool-defined parameters'],
      executionMode: capability.executionMode,
    };
  }).filter(Boolean) as Array<Record<string, unknown>>;
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error('AI response was not valid JSON.');
  }
}

async function callOpenAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  timeoutMs: number,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error('OPENAI_MODEL is not configured.');
  const response = await fetchWithTimeout(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: parseBoundedInteger(
        process.env.FLIXO_AI_DEFAULT_MAX_TOKENS,
        DEFAULT_MAX_TOKENS,
        128,
        MAX_RESPONSE_TOKENS,
      ),
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned HTTP ${response.status}.`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content.');
  return content;
}

async function callOpenRouter(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  timeoutMs: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');
  const base = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = process.env.OPENROUTER_MODEL || process.env.OPENROUTER_FREE_MODEL || 'openrouter/free';
  const response = await fetchWithTimeout(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.VITE_SITE_URL || 'https://flixoai.vercel.app',
      'X-Title': 'FLIXO AI',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: Number(process.env.FLIXO_AI_DEFAULT_MAX_TOKENS ?? 900),
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter returned HTTP ${response.status}.`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned no content.');
  return content;
}

async function callGemini(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  timeoutMs: number,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  const base = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new Error('GEMINI_MODEL is not configured.');
  const system = messages.find((message) => message.role === 'system')?.content ?? '';
  const contents = messages.filter((message) => message.role !== 'system').map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
  const response = await fetchWithTimeout(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: parseBoundedInteger(
          process.env.FLIXO_AI_DEFAULT_MAX_TOKENS,
          DEFAULT_MAX_TOKENS,
          128,
          MAX_RESPONSE_TOKENS,
        ),
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}.`);
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = data.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (!content) throw new Error('Gemini returned no content.');
  return content;
}

async function callProvider(
  provider: SupportedProvider,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  timeoutMs: number,
): Promise<string> {
  if (provider === 'gemini') return callGemini(messages, timeoutMs);
  if (provider === 'openrouter') return callOpenRouter(messages, timeoutMs);
  if (provider === 'openai') return callOpenAI(messages, timeoutMs);
  throw new Error('Unsupported AI provider.');
}

function fallbackDecision(message: string, file: AgentRequestContract['file']): ReturnType<typeof parseAgentDecision> {
  const normalized = message.toLocaleLowerCase();
  if (!file && /(?:الصوره|الصورة|image|photo|صور)/i.test(normalized)) {
    return {
      mode: 'clarify',
      reply: 'مفهوم. قبل التنفيذ أحتاج الصورة نفسها.',
      question: 'ارفع الصورة التي تريد العمل عليها، ثم أخبرني بالنتيجة المطلوبة.',
      plan: null,
      confidence: 0.9,
    };
  }
  return {
    mode: 'clarify',
    reply: 'أريد أن أتأكد من النتيجة التي تقصدها قبل اختيار الأداة.',
    question: 'ما النتيجة النهائية التي تريدها بالضبط؟',
    plan: null,
    confidence: 0.55,
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    json(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    const body = await readBody(req);
    const messages = [...(body.messages ?? [])].slice(-MAX_MESSAGES);
    const userMessage = messages[messages.length - 1]?.content;
    if (!userMessage) {
      json(res, 400, { error: 'At least one user message is required.' });
      return;
    }
    const locale = body.locale ?? 'en';
    const runtime = configuredRuntime();
    const provider = runtime.provider;
    const promptMessages = [
      {
        role: 'system' as const,
        content: buildFlixoAgentMasterPrompt({
          locale,
          file: body.file ?? null,
          activeCommand: body.activeCommand ?? null,
          activePlan: body.activePlan ?? null,
          catalog: executableCatalog(),
          catalogFingerprint: TOOL_CATALOG.fingerprint,
        }),
      },
      ...messages,
    ];
    const started = Date.now();
    let providerCalls = 0;
    const invoke = async (selectedProvider: SupportedProvider): Promise<string> => {
      if (providerCalls >= MAX_PROVIDER_CALLS) throw new Error('AI provider call budget exhausted.');
      providerCalls += 1;
      return callProvider(selectedProvider, promptMessages, runtime.timeoutMs);
    };
    try {
      const raw = await invoke(provider);
      const decision = parseAgentDecision(parseJsonObject(raw));
      json(res, 200, { ...decision, latencyMs: Date.now() - started, provider });
    } catch (providerError) {
      if (runtime.fallbackProvider) {
        try {
          const raw = await invoke(runtime.fallbackProvider);
          const decision = parseAgentDecision(parseJsonObject(raw));
          json(res, 200, { ...decision, latencyMs: Date.now() - started, provider: runtime.fallbackProvider, fallback: true });
          return;
        } catch (fallbackError) {
          console.error('[flixo-agent] provider failure', {
            primary: provider,
            fallback: runtime.fallbackProvider,
            primaryError: providerError instanceof Error ? providerError.name : 'unknown',
            fallbackError: fallbackError instanceof Error ? fallbackError.name : 'unknown',
          });
        }
      } else {
        console.error('[flixo-agent] provider failure', {
          provider,
          error: providerError instanceof Error ? providerError.name : 'unknown',
        });
      }
      const decision = fallbackDecision(userMessage, body.file);
      json(res, 200, { ...decision, fallback: true });
    }
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'Request body is too large.'
      || error.message === 'Invalid FLIXO AI runtime configuration.'
      || error.message === 'Unsupported FLIXO AI provider configuration.'
      || error.message === 'Invalid FLIXO AI fallback configuration.'
    )) {
      json(res, error.message === 'Request body is too large.' ? 413 : 503, {
        error: error.message === 'Request body is too large.' ? 'Request body is too large.' : 'AI service is temporarily unavailable.',
      });
      return;
    }
    json(res, 400, { error: 'Invalid FLIXO agent request.' });
  }
}
