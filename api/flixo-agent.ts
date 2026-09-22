import type { IncomingMessage, ServerResponse } from 'node:http';
import { getCapability, getExecutableCapabilityIds } from '../src/lib/agent/capability-registry.ts';
import { parseAgentDecision, parseAgentRequest, type AgentRequestContract } from '../src/lib/contracts/agent-gateway.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { buildFlixoAgentMasterPrompt } from '../src/lib/agent/flixo-agent-master-prompt.ts';

const MAX_INPUT_CHARS = Math.max(2000, Number(process.env.FLIXO_AI_MAX_INPUT_CHARS ?? 12000));
const MAX_MESSAGES = 24;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<AgentRequestContract> {
  let raw = '';
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 500_000) throw new Error('Request body is too large.');
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
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    throw new Error('AI response was not valid JSON.');
  }
}

async function callOpenAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error('OPENAI_MODEL is not configured.');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: Number(process.env.FLIXO_AI_DEFAULT_MAX_TOKENS ?? 900),
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
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');
  const base = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = process.env.OPENROUTER_MODEL || process.env.OPENROUTER_FREE_MODEL || 'openrouter/free';
  const response = await fetch(`${base}/chat/completions`, {
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
  const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: Number(process.env.FLIXO_AI_DEFAULT_MAX_TOKENS ?? 900),
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
  provider: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  if (provider === 'gemini') return callGemini(messages);
  if (provider === 'openrouter') return callOpenRouter(messages);
  return callOpenAI(messages);
}

function fallbackDecision(message: string, file: RequestBody['file']): AgentDecision {
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
    const provider = (process.env.FLIXO_AI_PROVIDER || 'openai').toLocaleLowerCase();
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
    try {
      const raw = await callProvider(provider, promptMessages);
      const decision = parseAgentDecision(parseJsonObject(raw));
      json(res, 200, { ...decision, latencyMs: Date.now() - started, provider });
    } catch (providerError) {
      if (process.env.FLIXO_AI_FALLBACK_PROVIDER && process.env.FLIXO_AI_FALLBACK_PROVIDER !== provider) {
        const fallbackProvider = process.env.FLIXO_AI_FALLBACK_PROVIDER.toLocaleLowerCase();
        const raw = await callProvider(fallbackProvider, promptMessages);
        const decision = parseAgentDecision(parseJsonObject(raw));
        json(res, 200, { ...decision, latencyMs: Date.now() - started, provider: fallbackProvider, fallback: true });
        return;
      }
      const decision = fallbackDecision(userMessage, body.file);
      json(res, 200, { ...decision, fallback: true, reason: providerError instanceof Error ? providerError.message : 'AI provider failure.' });
    }
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : 'Invalid FLIXO agent request.' });
  }
}
