import { createHash, timingSafeEqual } from 'node:crypto';
import { parseAgentEvent, type AgentEventEnvelope } from './event-envelope';
import { appendAgentTaskEvent, isDurableAgentTaskStoreConfigured } from '@/server/agent/durable-task-store';

export type EventGatewayResult = Readonly<{
  accepted: boolean;
  duplicate: boolean;
  event: AgentEventEnvelope;
}>;

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyEventGatewaySecret(input: string | undefined): boolean {
  const expected = process.env.FLIXO_EVENT_GATEWAY_SECRET?.trim();
  if (!expected) return false;
  const provided = input?.trim() ?? '';
  if (!provided) return false;
  return constantTimeEqual(
    createHash('sha256').update(provided).digest('hex'),
    createHash('sha256').update(expected).digest('hex'),
  );
}

export async function acceptAgentEvent(value: unknown): Promise<EventGatewayResult> {
  const event = parseAgentEvent(value);
  if (!event.taskId) {
    return Object.freeze({ accepted: true, duplicate: false, event });
  }
  if (!isDurableAgentTaskStoreConfigured()) {
    return Object.freeze({ accepted: true, duplicate: false, event });
  }
  try {
    await appendAgentTaskEvent(event);
    return Object.freeze({ accepted: true, duplicate: false, event });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique|23505/i.test(error.message)) {
      return Object.freeze({ accepted: true, duplicate: true, event });
    }
    throw error;
  }
}
