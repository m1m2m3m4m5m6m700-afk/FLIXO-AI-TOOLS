import { createAgentEvent, type AgentEventEnvelope } from './event-gateway.ts';

export const AGENT_SCHEDULE_VERSION = 1 as const;

export type ScheduleKind = 'ONCE' | 'INTERVAL' | 'CRON';
export type ScheduleDefinition = Readonly<{
  version: typeof AGENT_SCHEDULE_VERSION;
  scheduleId: string;
  kind: ScheduleKind;
  eventType: string;
  enabled: boolean;
  timezone: string;
  runAt?: string | null;
  intervalMs?: number | null;
  cron?: string | null;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type ScheduleTickResult = Readonly<{
  due: boolean;
  reason: 'DISABLED' | 'NOT_DUE' | 'DUE' | 'INVALID';
  nextAt: string | null;
}>;

const CRON_PATTERN = /^(?:\S+\s+){4}\S+$/u;

function assertScheduleId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/u.test(normalized)) throw new Error('AGENT_SCHEDULE_ID_INVALID');
  return normalized;
}

function assertIntervalMs(value: number | null | undefined): number {
  if (value === undefined || value === null || !Number.isInteger(value) || value < 1_000 || value > 31_536_000_000) {
    throw new Error('AGENT_SCHEDULE_INTERVAL_INVALID');
  }
  return value;
}

export function parseScheduleDefinition(input: ScheduleDefinition): ScheduleDefinition {
  const scheduleId = assertScheduleId(input.scheduleId);
  if (!['ONCE', 'INTERVAL', 'CRON'].includes(input.kind)) throw new Error('AGENT_SCHEDULE_KIND_INVALID');
  if (!input.eventType.trim()) throw new Error('AGENT_SCHEDULE_EVENT_TYPE_INVALID');
  if (!input.timezone.trim()) throw new Error('AGENT_SCHEDULE_TIMEZONE_REQUIRED');

  if (input.kind === 'ONCE') {
    if (!input.runAt || Number.isNaN(Date.parse(input.runAt))) throw new Error('AGENT_SCHEDULE_RUN_AT_INVALID');
  }
  if (input.kind === 'INTERVAL') assertIntervalMs(input.intervalMs);
  if (input.kind === 'CRON' && (!input.cron || !CRON_PATTERN.test(input.cron.trim()))) {
    throw new Error('AGENT_SCHEDULE_CRON_INVALID');
  }

  return Object.freeze({
    ...input,
    scheduleId,
    eventType: input.eventType.trim(),
    timezone: input.timezone.trim(),
    payload: Object.freeze({ ...(input.payload ?? {}) }),
  });
}

export function evaluateSchedule(
  definition: ScheduleDefinition,
  now = new Date(),
  lastRunAt: string | null = null,
): ScheduleTickResult {
  let schedule: ScheduleDefinition;
  try {
    schedule = parseScheduleDefinition(definition);
  } catch {
    return Object.freeze({ due: false, reason: 'INVALID', nextAt: null });
  }

  if (!schedule.enabled) return Object.freeze({ due: false, reason: 'DISABLED', nextAt: null });

  if (schedule.kind === 'ONCE') {
    const runAt = new Date(schedule.runAt as string);
    const due = now.getTime() >= runAt.getTime() && !lastRunAt;
    return Object.freeze({
      due,
      reason: due ? 'DUE' : 'NOT_DUE',
      nextAt: due ? null : runAt.toISOString(),
    });
  }

  if (schedule.kind === 'INTERVAL') {
    const interval = assertIntervalMs(schedule.intervalMs);
    const baseline = lastRunAt ? Date.parse(lastRunAt) : now.getTime();
    if (Number.isNaN(baseline)) return Object.freeze({ due: false, reason: 'INVALID', nextAt: null });
    const nextAt = baseline + interval;
    const due = lastRunAt ? now.getTime() >= nextAt : true;
    return Object.freeze({
      due,
      reason: due ? 'DUE' : 'NOT_DUE',
      nextAt: new Date(due ? now.getTime() + interval : nextAt).toISOString(),
    });
  }

  return Object.freeze({ due: false, reason: 'NOT_DUE', nextAt: null });
}

export function createScheduleEvent(
  definition: ScheduleDefinition,
  input: Readonly<{
    userId?: string | null;
    conversationId?: string | null;
    taskId?: string | null;
    traceId?: string | null;
    occurredAt?: string;
  }> = {},
): AgentEventEnvelope {
  const schedule = parseScheduleDefinition(definition);
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  return createAgentEvent({
    source: 'SCHEDULE',
    eventType: schedule.eventType,
    occurredAt,
    userId: input.userId ?? null,
    conversationId: input.conversationId ?? null,
    taskId: input.taskId ?? null,
    traceId: input.traceId ?? null,
    idempotencyKey: `schedule:${schedule.scheduleId}:${occurredAt.slice(0, 19)}`,
    payload: {
      scheduleId: schedule.scheduleId,
      kind: schedule.kind,
      timezone: schedule.timezone,
      ...(schedule.payload ?? {}),
    },
  });
}
