import type { ExecutionPlan } from '@/lib/ai/planner';
import type { ExecutionPlanContract } from '@/lib/contracts/ai-plan';
import { parseAgentDecision } from '@/lib/contracts/agent-gateway';

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
  plan: ExecutionPlanContract | null;
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
  return parseAgentDecision(await response.json());
}
