import { z } from 'zod';

export const AGENT_EVENT_VERSION = 1 as const;

export const AgentEventSourceSchema = z.enum([
  'CHAT',
  'UPLOAD',
  'WEBHOOK',
  'SCHEDULE',
  'TOOL',
  'WORKFLOW',
  'SYSTEM',
]);

export const AgentEventTypeSchema = z.enum([
  'INPUT_RECEIVED',
  'USER_MESSAGE',
  'AGENT_DECISION',
  'TASK_STATE',
  'APPROVAL_REQUESTED',
  'APPROVAL_GRANTED',
  'APPROVAL_DENIED',
  'WORKFLOW_STARTED',
  'WORKFLOW_STEP',
  'EXECUTION_STARTED',
  'EXECUTION_FINISHED',
  'EXECUTION_FAILED',
  'TASK_CANCELLED',
  'SYSTEM',
]);

export const AgentEventEnvelopeSchema = z.object({
  version: z.literal(AGENT_EVENT_VERSION),
  eventId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(256),
  source: AgentEventSourceSchema,
  type: AgentEventTypeSchema,
  conversationId: z.string().trim().min(1).max(256),
  taskId: z.string().trim().min(1).max(256).nullable(),
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()),
}).strict();

export type AgentEventEnvelope = z.infer<typeof AgentEventEnvelopeSchema>;

export function createAgentEvent(input: {
  source: AgentEventEnvelope['source'];
  type: AgentEventEnvelope['type'];
  conversationId: string;
  taskId?: string | null;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  eventId?: string;
  occurredAt?: string;
}): AgentEventEnvelope {
  return AgentEventEnvelopeSchema.parse({
    version: AGENT_EVENT_VERSION,
    eventId: input.eventId ?? crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey,
    source: input.source,
    type: input.type,
    conversationId: input.conversationId,
    taskId: input.taskId ?? null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload ?? {},
  });
}

export function parseAgentEvent(value: unknown): AgentEventEnvelope {
  return AgentEventEnvelopeSchema.parse(value);
}
