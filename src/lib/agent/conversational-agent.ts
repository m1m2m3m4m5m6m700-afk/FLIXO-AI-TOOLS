import type { ExecutionPlan } from '@/lib/ai/planner';

export type ConversationalAgentMessage = Readonly<{
  role: 'user' | 'assistant';
  content: string;
}>;

export type ConversationalAgentRequest = Readonly<{
  locale: string;
  messages: readonly ConversationalAgentMessage[];
  file?: { name: string; type: string; size: number } | null;
  activePlan?: ExecutionPlan | null;
  activeCommand?: string | null;
}>;

export type ConversationalAgentDecision = Readonly<{
  mode: 'chat' | 'clarify' | 'plan';
  reply: string;
  question: string | null;
  plan: ExecutionPlan | null;
  confidence: number;
  latencyMs?: number;
  provider?: string;
  fallback?: boolean;
  reason?: string;
}>;

export async function askConversationalAgent(request: ConversationalAgentRequest): Promise<ConversationalAgentDecision> {
  const response = await fetch('/api/flixo-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`FLIXO agent gateway returned HTTP ${response.status}.`);
  const result = await response.json() as ConversationalAgentDecision;
  if (!result || typeof result.reply !== 'string') throw new Error('FLIXO agent returned an invalid response.');
  return result;
}
