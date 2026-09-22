import { z } from 'zod';
import { safeParseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan';

export type ConversationalAgentMessage = Readonly<{
  role: 'user' | 'assistant';
  content: string;
}>;

export type ConversationalAgentRequest = Readonly<{
  locale: string;
  messages: readonly ConversationalAgentMessage[];
  file?: { name: string; type: string; size: number } | null;
  activePlan?: ExecutionPlanContract | null;
  activeCommand?: string | null;
}>;

export type ConversationalAgentDecision = Readonly<{
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

const ConversationalAgentDecisionSchema = z.object({
  mode: z.enum(['chat', 'clarify', 'plan']),
  reply: z.string().min(1),
  question: z.string().nullable(),
  plan: z.unknown().nullable(),
  confidence: z.number().finite().min(0).max(1),
  latencyMs: z.number().finite().nonnegative().optional(),
  provider: z.string().min(1).optional(),
  fallback: z.boolean().optional(),
  reason: z.string().optional(),
}).strict();

export async function askConversationalAgent(request: ConversationalAgentRequest): Promise<ConversationalAgentDecision> {
  const response = await fetch('/api/flixo-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`FLIXO agent gateway returned HTTP ${response.status}.`);

  const parsedEnvelope = ConversationalAgentDecisionSchema.safeParse(await response.json());
  if (!parsedEnvelope.success) throw new Error('FLIXO agent returned a malformed decision envelope.');

  let plan: ExecutionPlanContract | null = null;
  if (parsedEnvelope.data.plan !== null) {
    const parsedPlan = safeParseExecutionPlan(parsedEnvelope.data.plan);
    if (!parsedPlan.success) throw new Error('FLIXO agent returned an invalid execution plan.');
    plan = parsedPlan.data;
  }

  if (parsedEnvelope.data.mode === 'plan' && plan === null) {
    throw new Error('FLIXO agent returned plan mode without a canonical execution plan.');
  }
  if (parsedEnvelope.data.mode !== 'plan' && plan !== null) {
    throw new Error('FLIXO agent returned an execution plan outside plan mode.');
  }

  return Object.freeze({
    ...parsedEnvelope.data,
    plan,
  });
}
