import { z } from 'zod';
import { parseExecutionPlan, type ExecutionPlanContract } from './ai-plan.ts';

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
  messages: z.array(ChatMessageSchema).max(24).optional(),
  file: AgentFileSchema.nullable().optional(),
  activePlan: z.unknown().nullable().optional(),
  activeCommand: z.string().trim().max(2_000).nullable().optional(),
}).strict();

export type AgentRequestContract = Readonly<{
  locale?: string;
  messages?: readonly z.infer<typeof ChatMessageSchema>[];
  file?: z.infer<typeof AgentFileSchema> | null;
  activePlan?: ExecutionPlanContract | null;
  activeCommand?: string | null;
}>;

export function parseAgentRequest(value: unknown): AgentRequestContract {
  const parsed = AgentRequestSchema.parse(value);
  const activePlan = parsed.activePlan == null ? null : parseExecutionPlan(parsed.activePlan);
  return Object.freeze({
    ...parsed,
    activePlan,
  });
}

const AgentDecisionEnvelopeSchema = z.object({
  mode: z.enum(['chat', 'clarify', 'plan']),
  reply: z.string().trim().min(1).max(20_000),
  question: z.string().trim().max(8_000).nullable(),
  plan: z.unknown().nullable(),
  confidence: z.number().finite().min(0).max(1),
  latencyMs: z.number().int().nonnegative().optional(),
  provider: z.string().trim().max(128).optional(),
  fallback: z.boolean().optional(),
  reason: z.string().trim().max(4_000).optional(),
}).strict();

export type AgentDecisionContract = Readonly<{
  mode: 'chat' | 'clarify' | 'plan';
  reply: string;
  question: string | null;
  plan: ExecutionPlanContract | null;
  confidence: number;
  latencyMs?: number;
  provider?: string;
  fallback?: boolean;
  reason?: string;
}>;

export function parseAgentDecision(value: unknown): AgentDecisionContract {
  const envelope = AgentDecisionEnvelopeSchema.parse(value);
  if (envelope.mode === 'clarify' && !envelope.question) {
    throw new Error('Clarification mode requires a question.');
  }
  if (envelope.mode !== 'plan') {
    if (envelope.plan !== null) throw new Error('Non-plan AI decisions must not contain a plan.');
    return Object.freeze({
      mode: envelope.mode,
      reply: envelope.reply,
      question: envelope.question,
      plan: null,
      confidence: envelope.confidence,
      ...(envelope.latencyMs === undefined ? {} : { latencyMs: envelope.latencyMs }),
      ...(envelope.provider === undefined ? {} : { provider: envelope.provider }),
      ...(envelope.fallback === undefined ? {} : { fallback: envelope.fallback }),
      ...(envelope.reason === undefined ? {} : { reason: envelope.reason }),
    });
  }
  const plan = parseExecutionPlan(envelope.plan);
  return Object.freeze({
    mode: 'plan',
    reply: envelope.reply,
    question: null,
    plan,
    confidence: envelope.confidence,
    ...(envelope.latencyMs === undefined ? {} : { latencyMs: envelope.latencyMs }),
    ...(envelope.provider === undefined ? {} : { provider: envelope.provider }),
    ...(envelope.fallback === undefined ? {} : { fallback: envelope.fallback }),
    ...(envelope.reason === undefined ? {} : { reason: envelope.reason }),
  });
}
