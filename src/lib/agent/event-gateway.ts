import { createHash } from 'node:crypto';

export const AGENT_EVENT_VERSION = 1 as const;

export type AgentEventSource =
  | 'USER_MESSAGE'
  | 'FILE_UPLOAD'
  | 'SCHEDULE'
  | 'WEBHOOK'
  | 'TOOL_RESULT'
  | 'SYSTEM';

export type AgentEventEnvelope = Readonly<{
  version: typeof AGENT_EVENT_VERSION;
  eventId: string;
  source: AgentEventSource;
  eventType: string;
  occurredAt: string;
  idempotencyKey: string;
  userId: string | null;
  conversationId: string | null;
  taskId: string | null;
  traceId: string | null;
  payload: Readonly<Record<string, unknown>>;
}>;

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,256}$/u;

function assertId(value: string | null, code: string): void {
  if (value !== null && (!ID_PATTERN.test(value) || !value.trim())) throw new Error(code);
}

function normalizeText(value: string, code: string, maxLength = 256): string {
  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d || point === 0x7f;
  });
  if (!normalized || normalized.length > maxLength || hasControlCharacter) throw new Error(code);
  return normalized;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function canonicalPayload(payload: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(canonicalize(payload));
}

export function deriveEventIdempotencyKey(input: {
  source: AgentEventSource;
  eventType: string;
  userId?: string | null;
  conversationId?: string | null;
  taskId?: string | null;
  payload: Readonly<Record<string, unknown>>;
}): string {
  const canonical = JSON.stringify({
    source: input.source,
    eventType: normalizeText(input.eventType, 'AGENT_EVENT_TYPE_INVALID', 128),
    userId: input.userId ?? null,
    conversationId: input.conversationId ?? null,
    taskId: input.taskId ?? null,
    payload: canonicalPayload(input.payload),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function createAgentEvent(input: {
  eventId?: string;
  source: AgentEventSource;
  eventType: string;
  occurredAt?: string;
  idempotencyKey?: string;
  userId?: string | null;
  conversationId?: string | null;
  taskId?: string | null;
  traceId?: string | null;
  payload?: Readonly<Record<string, unknown>>;
}): AgentEventEnvelope {
  const eventId = input.eventId?.trim() || crypto.randomUUID();
  const eventType = normalizeText(input.eventType, 'AGENT_EVENT_TYPE_INVALID', 128);
  const payload = Object.freeze({ ...(input.payload ?? {}) });
  assertId(input.userId ?? null, 'AGENT_EVENT_USER_ID_INVALID');
  assertId(input.conversationId ?? null, 'AGENT_EVENT_CONVERSATION_ID_INVALID');
  assertId(input.taskId ?? null, 'AGENT_EVENT_TASK_ID_INVALID');
  assertId(input.traceId ?? null, 'AGENT_EVENT_TRACE_ID_INVALID');

  const idempotencyKey = input.idempotencyKey?.trim() || deriveEventIdempotencyKey({
    source: input.source,
    eventType,
    userId: input.userId ?? null,
    conversationId: input.conversationId ?? null,
    taskId: input.taskId ?? null,
    payload,
  });

  return Object.freeze({
    version: AGENT_EVENT_VERSION,
    eventId: normalizeText(eventId, 'AGENT_EVENT_ID_INVALID'),
    source: input.source,
    eventType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    idempotencyKey: normalizeText(idempotencyKey, 'AGENT_EVENT_IDEMPOTENCY_KEY_INVALID', 512),
    userId: input.userId ?? null,
    conversationId: input.conversationId ?? null,
    taskId: input.taskId ?? null,
    traceId: input.traceId ?? null,
    payload,
  });
}

export function assertAgentEvent(event: AgentEventEnvelope): void {
  if (event.version !== AGENT_EVENT_VERSION) throw new Error('AGENT_EVENT_VERSION_UNSUPPORTED');
  normalizeText(event.eventId, 'AGENT_EVENT_ID_INVALID');
  normalizeText(event.eventType, 'AGENT_EVENT_TYPE_INVALID', 128);
  normalizeText(event.idempotencyKey, 'AGENT_EVENT_IDEMPOTENCY_KEY_INVALID', 512);
  assertId(event.userId, 'AGENT_EVENT_USER_ID_INVALID');
  assertId(event.conversationId, 'AGENT_EVENT_CONVERSATION_ID_INVALID');
  assertId(event.taskId, 'AGENT_EVENT_TASK_ID_INVALID');
  assertId(event.traceId, 'AGENT_EVENT_TRACE_ID_INVALID');
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw new Error('AGENT_EVENT_PAYLOAD_INVALID');
  }
}

export class AgentEventInbox {
  private readonly seen = new Set<string>();

  constructor(private readonly maxKeys = 10_000) {
    if (!Number.isInteger(maxKeys) || maxKeys < 1 || maxKeys > 100_000) throw new Error('AGENT_EVENT_INBOX_LIMIT_INVALID');
  }

  accept(event: AgentEventEnvelope): boolean {
    assertAgentEvent(event);
    if (this.seen.has(event.idempotencyKey)) return false;
    this.seen.add(event.idempotencyKey);
    if (this.seen.size > this.maxKeys) {
      const oldest = this.seen.values().next().value as string | undefined;
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }

  has(idempotencyKey: string): boolean {
    return this.seen.has(idempotencyKey);
  }

  clear(): void {
    this.seen.clear();
  }
}
