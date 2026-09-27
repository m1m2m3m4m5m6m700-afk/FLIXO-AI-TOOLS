import type { IncomingMessage, ServerResponse } from 'node:http';
import { ModelProviderClient } from '@flixo/agent-runtime';
import { createHash, randomUUID } from 'node:crypto';
import { parseAgentDecision, type AgentRequestContract } from '../src/lib/contracts/agent-gateway.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';
import { selectModelForTask } from '../src/lib/agent/model-router.ts';
import { buildFlixoHumanConversationPrompt } from '../src/lib/agent/human-conversation.ts';
import { createAgentEvent } from '../src/lib/agent/event-gateway.ts';
import { evaluatePlanApproval } from '../src/lib/agent/approval-policy.ts';
import { isDurableAgentTaskStoreConfigured, upsertAgentTask, appendAgentTaskEvent } from '../src/server/agent/durable-task-store.ts';
import { WORKFLOW_TOOL_CATALOG } from '../src/lib/agent/workflow-as-tool.ts';
import { listExternalAgentLearning } from '../src/server/agent/learning-persistence.ts';
import { rateLimit, RATE_PRESETS } from '../src/lib/server/security/csrf.ts';
import {
  beginFlixoBotGatewayRuntime,
  beginModelTurn,
  finalizeFlixoBotGatewayRuntime,
  finishModelTurn,
  markFlixoBotGatewayRuntimeStale,
  noteProviderFailure,
  toFlixoBotRuntimeSummary,
  type FlixoBotGatewayRuntime,
} from '../src/lib/agent/flixo-bot-runtime-adapter.ts';

const MAX_MESSAGES = 80;
const MAX_PROVIDER_CALLS = 2;
const DEFAULT_TIMEOUT_MS = 4_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 900;
const MAX_RESPONSE_TOKENS = 4_096;
const SUPPORTED_PROVIDERS = ['openai', 'openrouter', 'gemini'] as const;
const trustedProxyHeaders = () => process.env.FLIXO_TRUST_PROXY_HEADERS === 'true' || process.env.VERCEL === '1';

export function agentClientKey(req: IncomingMessage): string {
  if (trustedProxyHeaders()) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',').map((value) => value.trim()).filter(Boolean)[0];
    if (first) return 'ip:' + first;
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real.trim()) return 'ip:' + real.trim();
  }
  return 'socket:' + (req.socket?.remoteAddress ?? 'unknown');
}
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

async function callProvider(
  provider: SupportedProvider,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  timeoutMs: number,
  maxTokens: number,
  modelOverride?: string,
): Promise<string> {
  const client = new ModelProviderClient({
    provider,
    model: modelOverride,
    timeoutMs,
    maxTokens,
  });
  return client.complete(messages);
}

export function fallbackDecision(
  message: string,
  file: AgentRequestContract['file'],
  locale: string,
): ReturnType<typeof parseAgentDecision> {
  const normalized = message.trim().toLocaleLowerCase();
  const arabic = /[\u0600-\u06FF]/u.test(message) || locale.startsWith('ar');
  if (/^(?:مرحبا|مرحبًا|اهلا|أهلا|السلام عليكم|هاي|هلا|hello|hi|hey)\b/i.test(normalized)) {
    return {
      mode: 'chat',
      reply: arabic ? 'أهلًا 👋 أنا FLIXO BOT. قل لي ما الذي تريد الوصول إليه، وسأفهمك خطوة بخطوة.' : 'Hi 👋 I’m FLIXO BOT. Tell me what you want to achieve and I’ll follow the conversation step by step.',
      question: null,
      plan: null,
      confidence: 0.98,
    };
  }
  if (/^(?:من انت|من أنت|مين انت|who are you)\??$/i.test(normalized)) {
    return {
      mode: 'chat',
      reply: arabic ? 'أنا FLIXO BOT، المساعد الذي يفهم طلبك الطبيعي ويحوله إلى خطوات آمنة داخل أدوات FLIXO.' : 'I’m FLIXO BOT, the assistant that understands natural requests and turns them into safe FLIXO tool steps.',
      question: null,
      plan: null,
      confidence: 0.98,
    };
  }
  if (/^(?:شكرا|شكرًا|thanks|thank you|تمام|ممتاز)\b/i.test(normalized)) {
    return {
      mode: 'chat',
      reply: arabic ? 'العفو. أكمل معي من حيث توقفت.' : 'You’re welcome. Continue from where we left off.',
      question: null,
      plan: null,
      confidence: 0.97,
    };
  }
  if (!file && /(?:الصوره|الصورة|image|photo|صور)/i.test(normalized)) {
    return {
      mode: 'clarify',
      reply: arabic ? 'مفهوم. أحتاج الصورة نفسها قبل أن نكمل.' : 'Understood. I need the image itself before we continue.',
      question: arabic ? 'ارفع الصورة، ثم قل لي النتيجة التي تريد الوصول إليها.' : 'Upload the image, then tell me the result you want.',
      plan: null,
      confidence: 0.9,
    };
  }

  const deterministicPlan = planFromIntent(message);
  if (file && deterministicPlan) {
    return {
      mode: 'plan',
      reply: arabic
        ? 'تعذر الوصول إلى مزوّد الذكاء الاصطناعي، فاعتمدت الخطة الحتمية الآمنة المتاحة محليًا.'
        : 'The AI provider was unavailable, so I used the available deterministic safe plan.',
      question: null,
      plan: deterministicPlan,
      confidence: deterministicPlan.confidence,
      reason: 'DETERMINISTIC_QUICKFLOW_FALLBACK',
    };
  }

  return {
    mode: 'clarify',
    reply: arabic ? 'أفهم أنك تريد المساعدة. أحتاج تحديد النتيجة المطلوبة حتى أقدر أساعدك بدقة.' : 'I understand you want help. I need the desired result so I can guide you precisely.',
    question: arabic ? 'ما النتيجة التي تريدها من الصورة؟' : 'What result do you want from the image?',
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
  const budget = rateLimit(agentClientKey(req), RATE_PRESETS.toolRequest);
  if (!budget.allowed) {
    res.setHeader('retry-after', '10');
    json(res, 429, { error: 'Too many FLIXO agent requests.' });
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
    const conversationId = body.conversationId ?? 'UI-CONVERSATION:' + randomUUID();
    const taskId = body.taskId ?? 'UI-FLIXO-TASK:' + randomUUID();
    const idempotencyKey = body.idempotencyKey ?? 'chat:' + conversationId + ':' + taskId + ':' + messages.length;
    const inboundEvent = createAgentEvent({
      source: body.file ? 'FILE_UPLOAD' : 'USER_MESSAGE',
      eventType: 'chat.message',
      idempotencyKey,
      conversationId,
      taskId,
      payload: {
        locale,
        messageDigest: createHash('sha256').update(userMessage, 'utf8').digest('hex'),
        messageLength: userMessage.length,
        hasFile: Boolean(body.file),
      },
    });
    const runtime = configuredRuntime();
    const provider = runtime.provider;
    const recentMessages = messages.slice(-24);
    const sharedLearning = { lessons: [], antiLessons: [], advice: [], errors: [], obligations: [], counterexamples: [], verifications: [] };
    const targetSha = exactSha();
    let botRuntime: FlixoBotGatewayRuntime | null = targetSha
      ? beginFlixoBotGatewayRuntime({
        taskId,
        exactSha: targetSha,
        request: userMessage,
      })
      : null;

    const persistTaskEvent = async (
      event: ReturnType<typeof createAgentEvent>,
      state: { lifecycle: 'QUEUED' | 'PLANNED' | 'AWAITING_CONFIRMATION' | 'RUNNING' | 'VERIFYING' | 'RECOVERING' | 'RESUMED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; taskState: 'IDLE' | 'NEEDS_INPUT' | 'PLANNED' | 'AWAITING_CONFIRMATION' | 'EXECUTING' | 'VERIFYING' | 'RECOVERING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; confirmationRequired: boolean; revision: number; plan?: unknown | null; runtime?: unknown | null; lastError?: string | null },
    ): Promise<void> => {
      if (!isDurableAgentTaskStoreConfigured()) return;
      await upsertAgentTask({
        taskId,
        conversationId,
        ownerId: conversationId,
        lifecycle: state.lifecycle,
        state: state.taskState,
        revision: state.revision,
        confirmationRequired: state.confirmationRequired,
        request: userMessage,
        plan: state.plan ?? null,
        runtime: state.runtime ?? null,
        lastError: state.lastError ?? null,
      });
      await appendAgentTaskEvent(event);
    };

    await persistTaskEvent(
      inboundEvent,
      { lifecycle: 'QUEUED', taskState: 'IDLE', confirmationRequired: false, revision: 0 },
    ).catch((error) => {
      console.warn('[flixo-agent] durable input persistence warning', {
        error: error instanceof Error ? error.name : 'unknown',
      });
    });
    const remoteLearning = targetSha ? await listExternalAgentLearning(targetSha, 48).catch(() => []) : [];
    const trustedRemoteLearning = remoteLearning.filter((item) => item.status === 'VERIFIED' && item.canonical_green === true);
    const remoteLessons = trustedRemoteLearning.filter((item) => item.kind === 'LESSON');
    const remoteAntiLessons = trustedRemoteLearning.filter((item) => item.kind === 'ANTI_LESSON');
    const remoteAdvice = trustedRemoteLearning.filter((item) => item.kind === 'ADVICE');
    const remoteCounterexamples = trustedRemoteLearning.filter((item) => item.kind === 'COUNTEREXAMPLE');
    const promptMessages = [
      {
        role: 'system' as const,
        content: buildFlixoHumanConversationPrompt({
          locale,
          currentMessage: userMessage,
          collectiveLearning: {
            authority: 'CONTEXT_ONLY',
            mutationAuthority: false,
            certificationAuthority: false,
            lessons: [...remoteLessons, ...sharedLearning.lessons],
            antiLessons: [...remoteAntiLessons, ...sharedLearning.antiLessons],
            advice: [...remoteAdvice, ...sharedLearning.advice],
            errors: sharedLearning.errors,
            obligations: sharedLearning.obligations,
            counterexamples: [...remoteCounterexamples, ...sharedLearning.counterexamples],
            verifications: sharedLearning.verifications,
            externalLearningCandidates: [],
          },
          file: body.file ?? null,
          activeCommand: body.activeCommand ?? null,
          activePlan: body.activePlan ?? null,
          catalog: executableCatalog(),
          layeredMemory: body.memory,
          workflowCatalog: WORKFLOW_TOOL_CATALOG.map((tool) => ({
            id: tool.id,
            title: tool.title,
            description: tool.description,
            intents: tool.intents,
            stepToolIds: tool.stepToolIds,
          })),
          catalogFingerprint: TOOL_CATALOG.fingerprint,
        }),
      },
      ...recentMessages,
    ];
    const started = Date.now();
    let providerCalls = 0;
    let lastModel: string | null = null;
    const invoke = async (selectedProvider: SupportedProvider): Promise<string> => {
      if (providerCalls >= MAX_PROVIDER_CALLS) throw new Error('AI provider call budget exhausted.');
      providerCalls += 1;
      const modelSelection = selectModelForTask({ taskInput: userMessage, provider: selectedProvider });
      lastModel = modelSelection.model;
      if (!botRuntime) return callProvider(selectedProvider, promptMessages, runtime.timeoutMs, runtime.maxTokens, modelSelection.model);
      const turn = beginModelTurn(botRuntime, selectedProvider);
      botRuntime = turn.runtime;
      try {
        const raw = await callProvider(selectedProvider, promptMessages, runtime.timeoutMs, runtime.maxTokens, modelSelection.model);
        botRuntime = finishModelTurn(botRuntime, turn.spanId, 'success');
        return raw;
      } catch (error) {
        botRuntime = finishModelTurn(botRuntime, turn.spanId, 'failure');
        throw error;
      }
    };

    const respondWithRuntime = async (decision: ReturnType<typeof parseAgentDecision>, extra: Record<string, unknown> = {}) => {
      if (botRuntime) {
        try {
          const currentSha = exactSha();
          if (currentSha && currentSha !== botRuntime.state.exactSha) {
            botRuntime = markFlixoBotGatewayRuntimeStale(botRuntime, currentSha);
            extra.runtimeStale = true;
          } else {
            botRuntime = finalizeFlixoBotGatewayRuntime(botRuntime, decision.mode, decision);
          }
          extra.runtime = toFlixoBotRuntimeSummary(botRuntime);
        } catch (runtimeError) {
          console.warn('[flixo-agent] runtime finalization warning', {
            error: runtimeError instanceof Error ? runtimeError.name : 'unknown',
          });
          extra.runtime = botRuntime ? toFlixoBotRuntimeSummary(botRuntime) : null;
        }
      } else {
        extra.runtime = null;
      }

      const approval = decision.plan ? evaluatePlanApproval(decision.plan) : null;
      const responseDecision = Object.freeze({
        ...decision,
        approval,
      });

      const runtimeSummary = extra.runtime ?? null;
      const taskState = responseDecision.mode === 'plan'
        ? 'AWAITING_CONFIRMATION'
        : responseDecision.mode === 'clarify'
          ? 'NEEDS_INPUT'
          : 'IDLE';
      const lifecycle = responseDecision.mode === 'plan'
        ? 'AWAITING_CONFIRMATION'
        : 'QUEUED';

      await persistTaskEvent(
        createAgentEvent({
          source: 'SYSTEM',
          eventType: responseDecision.mode === 'plan' ? 'agent.plan' : 'agent.decision',
          idempotencyKey: idempotencyKey + ':decision:' + responseDecision.mode,
          conversationId,
          taskId,
          traceId: botRuntime?.state.traceId ?? null,
          payload: {
            mode: responseDecision.mode,
            confidence: responseDecision.confidence,
            approval,
            provider: responseDecision.provider ?? extra.provider ?? null,
            model: extra.model ?? null,
          },
        }),
        {
          lifecycle,
          taskState,
          confirmationRequired: responseDecision.mode === 'plan',
          revision: responseDecision.mode === 'plan' ? 2 : 1,
          plan: responseDecision.plan,
          runtime: runtimeSummary,
        },
      ).catch((error) => {
        console.warn('[flixo-agent] durable decision persistence warning', {
          error: error instanceof Error ? error.name : 'unknown',
        });
      });

      json(res, 200, { ...responseDecision, ...extra, approval, taskId, conversationId });
    };
    try {
      const raw = await invoke(provider);
      const decision = parseAgentDecision(parseJsonObject(raw));
      const boundedDecision = enforceDeterministicExecutionBoundary(userMessage, decision);
      await persistLearningCandidate(boundedDecision, userMessage, locale, provider);
      await respondWithRuntime(boundedDecision, { latencyMs: Date.now() - started, provider, model: lastModel });
    } catch (providerError) {
      if (botRuntime) botRuntime = noteProviderFailure(botRuntime, `${provider}:${providerError instanceof Error ? providerError.name : 'UNKNOWN_ERROR'}`);
      if (runtime.fallbackProvider) {
        try {
          const raw = await invoke(runtime.fallbackProvider);
          const decision = parseAgentDecision(parseJsonObject(raw));
          const boundedDecision = enforceDeterministicExecutionBoundary(userMessage, decision);
          await persistLearningCandidate(boundedDecision, userMessage, locale, runtime.fallbackProvider);
          await respondWithRuntime(boundedDecision, { latencyMs: Date.now() - started, provider: runtime.fallbackProvider, model: lastModel, fallback: true });
          return;
        } catch (fallbackError) {
          if (botRuntime) botRuntime = noteProviderFailure(botRuntime, `${runtime.fallbackProvider}:${fallbackError instanceof Error ? fallbackError.name : 'UNKNOWN_ERROR'}`);
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
      const decision = fallbackDecision(userMessage, body.file, locale);
      const boundedDecision = enforceDeterministicExecutionBoundary(userMessage, decision);
      await respondWithRuntime(boundedDecision, { fallback: true });
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
