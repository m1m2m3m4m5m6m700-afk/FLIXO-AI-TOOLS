import { z } from 'zod';
import { parseExecutionPlan, type ExecutionPlanContract } from './ai-plan.ts';
import { LayeredMemorySchema, type LayeredMemorySnapshot } from '@/lib/agent/layered-memory.ts';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(12_000),
}).strict();

const AgentFileSchema = z.object({
  name: z.string().trim().min(1).max(512),
  type: z.string().max(128),
  size: z.number().int().nonnegative().max(256 * 1024 * 1024),
}).strict();

export const AgentRequestSchema = z.object({
  locale: z.string().trim().min(2).max(16).optional(),
  userId: z.string().trim().min(1).max(256).optional(),
  messages: z.array(ChatMessageSchema).max(120).optional(),
  file: AgentFileSchema.nullable().optional(),
  activePlan: z.unknown().nullable().optional(),
  activeCommand: z.string().trim().max(2_000).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(512).optional(),
  conversationId: z.string().trim().min(1).max(256).optional(),
  taskId: z.string().trim().min(1).max(256).nullable().optional(),
  memory: LayeredMemorySchema.nullable().optional(),
}).strict();

export type AgentRequestContract = Readonly<{
  locale?: string;
  userId?: string;
  messages?: readonly z.infer<typeof ChatMessageSchema>[];
  file?: z.infer<typeof AgentFileSchema> | null;
  activePlan?: ExecutionPlanContract | null;
  activeCommand?: string | null;
  idempotencyKey?: string;
  conversationId?: string;
  taskId?: string | null;
  memory?: LayeredMemorySnapshot | null;
}>;

export function parseAgentRequest(value: unknown): AgentRequestContract {
  const parsed = AgentRequestSchema.parse(value);
  const activePlan = parsed.activePlan == null ? null : parseExecutionPlan(parsed.activePlan);
  return Object.freeze({
    ...parsed,
    activePlan,
    memory: parsed.memory ?? null,
  });
}

export const AgentLearningCandidateSchema = z.object({
  kind: z.enum(['LESSON', 'ANTI_LESSON', 'ADVICE', 'COUNTEREXAMPLE']),
  claim: z.string().trim().min(1).max(8_000),
  content: z.string().trim().min(1).max(16_000),
  evidenceRefs: z.array(z.string().trim().min(1).max(512)).max(32).default([]),
}).strict();

export type AgentLearningCandidate = Readonly<{
  kind: 'LESSON' | 'ANTI_LESSON' | 'ADVICE' | 'COUNTEREXAMPLE';
  claim: string;
  content: string;
  evidenceRefs: readonly string[];
}>;

const AgentDecisionEnvelopeSchema = z.object({
  conversationId: z.string().trim().min(1).max(256).optional(),
  taskId: z.string().trim().min(1).max(256).optional(),
  mode: z.enum(['chat', 'clarify', 'plan']),
  reply: z.string().trim().min(1).max(20_000),
  question: z.string().trim().max(8_000).nullable(),
  plan: z.unknown().nullable(),
  confidence: z.number().finite().min(0).max(1),
  latencyMs: z.number().int().nonnegative().optional(),
  provider: z.string().trim().max(128).optional(),
  fallback: z.boolean().optional(),
  reason: z.string().trim().max(4_000).optional(),
  learning: AgentLearningCandidateSchema.nullable().optional(),
  approval: z.object({ level: z.enum(['AUTO', 'CONFIRM', 'BLOCK']), reasons: z.array(z.string().trim().min(1).max(512)).max(64) }).strict().nullable().optional(),
  runtime: z.object({
    protocol: z.string().trim().min(1).max(128),
    runId: z.string().trim().min(1).max(256),
    taskId: z.string().trim().min(1).max(256),
    status: z.enum(['CREATED', 'RUNNING', 'WAITING_APPROVAL', 'RETRYING', 'SUCCEEDED', 'FAILED', 'STALE', 'CANCELLED', 'BLOCKED']),
    traceId: z.string().trim().min(1).max(256),
    exactSha: z.string().regex(/^[a-f0-9]{40}$/u),
    turnCount: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
    maxToolCalls: z.number().int().positive(),
    toolCallCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    resumeState: z.string().max(100_000),
  }).nullable().optional(),
}).strict();

export type AgentDecisionContract = Readonly<{
  conversationId?: string;
  taskId?: string;
  mode: 'chat' | 'clarify' | 'plan';
  reply: string;
  question: string | null;
  plan: ExecutionPlanContract | null;
  confidence: number;
  latencyMs?: number;
  provider?: string;
  fallback?: boolean;
  reason?: string;
  learning?: AgentLearningCandidate | null;
  approval?: { level: 'AUTO' | 'CONFIRM' | 'BLOCK'; reasons: readonly string[] } | null;
  runtime?: {
    protocol: string;
    runId: string;
    taskId: string;
    status: 'CREATED' | 'RUNNING' | 'WAITING_APPROVAL' | 'RETRYING' | 'SUCCEEDED' | 'FAILED' | 'STALE' | 'CANCELLED' | 'BLOCKED';
    traceId: string;
    exactSha: string;
    turnCount: number;
    retryCount: number;
    maxToolCalls: number;
    toolCallCount: number;
    eventCount: number;
    resumeState: string;
  } | null;
}>;

export function parseAgentDecision(value: unknown): AgentDecisionContract {
  const envelope = AgentDecisionEnvelopeSchema.parse(value);
  if (envelope.mode === 'clarify' && !envelope.question) {
    throw new Error('Clarification mode requires a question.');
  }
  if (envelope.mode !== 'plan') {
    if (envelope.plan !== null) throw new Error('Non-plan AI decisions must not contain a plan.');
    return Object.freeze({
      ...(envelope.conversationId === undefined ? {} : { conversationId: envelope.conversationId }),
      ...(envelope.taskId === undefined ? {} : { taskId: envelope.taskId }),
      mode: envelope.mode,
      reply: envelope.reply,
      question: envelope.question,
      plan: null,
      confidence: envelope.confidence,
      ...(envelope.latencyMs === undefined ? {} : { latencyMs: envelope.latencyMs }),
      ...(envelope.provider === undefined ? {} : { provider: envelope.provider }),
      ...(envelope.fallback === undefined ? {} : { fallback: envelope.fallback }),
      ...(envelope.reason === undefined ? {} : { reason: envelope.reason }),
      ...(envelope.learning === undefined ? {} : { learning: envelope.learning }),
      ...(envelope.approval === undefined ? {} : { approval: envelope.approval }),
      ...(envelope.runtime === undefined ? {} : { runtime: envelope.runtime }),
    });
  }
  const plan = parseExecutionPlan(envelope.plan);
  return Object.freeze({
    ...(envelope.conversationId === undefined ? {} : { conversationId: envelope.conversationId }),
    ...(envelope.taskId === undefined ? {} : { taskId: envelope.taskId }),
    mode: 'plan',
    reply: envelope.reply,
    question: null,
    plan,
    confidence: envelope.confidence,
    ...(envelope.latencyMs === undefined ? {} : { latencyMs: envelope.latencyMs }),
    ...(envelope.provider === undefined ? {} : { provider: envelope.provider }),
    ...(envelope.fallback === undefined ? {} : { fallback: envelope.fallback }),
    ...(envelope.reason === undefined ? {} : { reason: envelope.reason }),
    ...(envelope.learning === undefined ? {} : { learning: envelope.learning }),
    ...(envelope.approval === undefined ? {} : { approval: envelope.approval }),
    ...(envelope.runtime === undefined ? {} : { runtime: envelope.runtime }),
  });
}
