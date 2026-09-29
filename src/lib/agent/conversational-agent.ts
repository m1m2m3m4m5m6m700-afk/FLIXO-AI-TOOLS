import { planFromIntent } from '@/lib/ai/planner';
import { parseExecutionPlan } from '@/lib/contracts/ai-plan';
import type { ExecutionPlanContract } from '@/lib/contracts/ai-plan';
import { toAgentFileMetadata } from '@/lib/contracts/mvp-scope.ts';
import type { LayeredMemorySnapshot } from './layered-memory.ts';

export type ConversationalAgentMessage = Readonly<{ role: 'user' | 'assistant'; content: string; }>;
export type ConversationalAgentRequest = Readonly<{
  locale: string;
  messages: readonly ConversationalAgentMessage[];
  file?: ReturnType<typeof toAgentFileMetadata>;
  activePlan?: { steps: readonly unknown[] } | null;
  activeCommand?: string | null;
  idempotencyKey?: string;
  conversationId?: string;
  taskId?: string | null;
  memory?: LayeredMemorySnapshot | null;
}>;
export type ConversationalAgentDecision = Readonly<{
  conversationId?: string; taskId?: string;
  approval?: { level: 'AUTO' | 'CONFIRM' | 'BLOCK'; reasons: readonly string[] } | null;
  mode: 'chat' | 'clarify' | 'plan'; reply: string; question: string | null;
  plan: ExecutionPlanContract | null; confidence: number; latencyMs?: number;
  provider?: string; fallback?: boolean; reason?: string;
  runtime?: { protocol: string; runId: string; taskId: string; status: string; traceId: string; exactSha: string; turnCount: number; retryCount: number; eventCount: number; resumeState: string; } | null;
}>;

/** Browser-first runtime: MVP execution never requires a public server Agent API. */
export async function askConversationalAgent(request: ConversationalAgentRequest): Promise<ConversationalAgentDecision> {
  const started = Date.now();
  const command = request.activeCommand?.trim() || [...request.messages].reverse().find((message) => message.role === 'user')?.content?.trim() || '';
  const arabic = /[\u0600-\u06FF]/u.test(command);
  const localPlan = command ? planFromIntent(command) : null;
  const plan = localPlan ? parseExecutionPlan(localPlan) : null;
  if (plan) return Object.freeze({ ...(request.conversationId ? { conversationId: request.conversationId } : {}), ...(request.taskId ? { taskId: request.taskId } : {}), mode: 'plan' as const, reply: arabic ? 'جهزت خطة محلية آمنة مرتبطة بكتالوج FLIXO الحالي.' : 'I prepared a safe local plan against the current FLIXO catalog.', question: null, plan, confidence: plan.confidence, latencyMs: Date.now() - started, provider: 'deterministic-local', fallback: true, reason: 'BROWSER_FIRST_RUNTIME_NO_PUBLIC_SERVER_AGENT_DEPENDENCY' });
  return Object.freeze({ ...(request.conversationId ? { conversationId: request.conversationId } : {}), ...(request.taskId ? { taskId: request.taskId } : {}), mode: 'chat' as const, reply: arabic ? 'لا توجد خطة تنفيذ محلية آمنة لهذه المهمة حاليًا. سأوجهك إلى الأداة اليدوية المناسبة بدل التخمين.' : 'There is no safe local execution plan for this request yet. I will route you to the matching manual tool instead of guessing.', question: null, plan: null, confidence: 0.25, latencyMs: Date.now() - started, provider: 'deterministic-local', fallback: true, reason: 'NO_LOCAL_EXECUTION_PLAN' });
}