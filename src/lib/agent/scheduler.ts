import type { AgentEventEnvelope, AgentEventSource } from './event-gateway.ts';

export const AGENT_SCHEDULE_VERSION = 1 as const;

export type ScheduledAgentJob = Readonly<{
  scheduleId: string;
  ownerId: string;
  conversationId: string | null;
  locale: string;
  prompt: string;
  nextRunAt: string;
  intervalSeconds: number | null;
  maxRuns: number | null;
  runCount: number;
  active: boolean;
  lastRunAt: string | null;
  lastEventId: string | null;
  leaseUntil: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type EventTriggerRule = Readonly<{
  source?: AgentEventSource;
  eventType: string;
  requiredPayloadKeys?: readonly string[];
}>;

function requireText(value: string, code: string, max = 256): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function normalizeDate(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

export function createScheduledAgentJob(input: Readonly<{
  scheduleId: string;
  ownerId: string;
  conversationId?: string | null;
  locale?: string;
  prompt: string;
  nextRunAt: string;
  intervalSeconds?: number | null;
  maxRuns?: number | null;
  metadata?: Readonly<Record<string, unknown>>;
}>): ScheduledAgentJob {
  const scheduleId = requireText(input.scheduleId, 'SCHEDULE_ID_REQUIRED');
  const ownerId = requireText(input.ownerId, 'SCHEDULE_OWNER_REQUIRED');
  const prompt = requireText(input.prompt, 'SCHEDULE_PROMPT_REQUIRED', 12_000);
  const nextRunAt = normalizeDate(input.nextRunAt, 'SCHEDULE_NEXT_RUN_INVALID');
  const intervalSeconds = input.intervalSeconds ?? null;
  const maxRuns = input.maxRuns ?? null;
  if (intervalSeconds !== null && (!Number.isInteger(intervalSeconds) || intervalSeconds < 60 || intervalSeconds > 31_536_000)) {
    throw new Error('SCHEDULE_INTERVAL_INVALID');
  }
  if (maxRuns !== null && (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 100_000)) {
    throw new Error('SCHEDULE_MAX_RUNS_INVALID');
  }
  return Object.freeze({
    scheduleId,
    ownerId,
    conversationId: input.conversationId?.trim() || null,
    locale: requireText(input.locale ?? 'en', 'SCHEDULE_LOCALE_REQUIRED', 16),
    prompt,
    nextRunAt,
    intervalSeconds,
    maxRuns,
    runCount: 0,
    active: true,
    lastRunAt: null,
    lastEventId: null,
    leaseUntil: null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function isScheduleDue(job: ScheduledAgentJob, now = new Date().toISOString()): boolean {
  if (!job.active) return false;
  const nowMs = Date.parse(now);
  const nextMs = Date.parse(job.nextRunAt);
  return Number.isFinite(nowMs) && Number.isFinite(nextMs) && nextMs <= nowMs
    && (job.leaseUntil === null || Date.parse(job.leaseUntil) <= nowMs);
}

export function advanceScheduledAgentJob(
  job: ScheduledAgentJob,
  ranAt = new Date().toISOString(),
  eventId: string | null = null,
): ScheduledAgentJob {
  const runCount = job.runCount + 1;
  const timestamp = normalizeDate(ranAt, 'SCHEDULE_RUN_AT_INVALID');
  const reachedMax = job.maxRuns !== null && runCount >= job.maxRuns;
  if (job.intervalSeconds === null || reachedMax) {
    return Object.freeze({
      ...job,
      runCount,
      active: false,
      lastRunAt: timestamp,
      lastEventId: eventId,
      leaseUntil: null,
    });
  }
  return Object.freeze({
    ...job,
    runCount,
    active: true,
    nextRunAt: new Date(Date.parse(timestamp) + job.intervalSeconds * 1000).toISOString(),
    lastRunAt: timestamp,
    lastEventId: eventId,
    leaseUntil: null,
  });
}

export function matchesEventTrigger(
  event: AgentEventEnvelope,
  rule: EventTriggerRule,
): boolean {
  if (rule.source && event.source !== rule.source) return false;
  if (event.eventType !== rule.eventType) return false;
  return (rule.requiredPayloadKeys ?? []).every((key) =>
    Object.prototype.hasOwnProperty.call(event.payload, key)
  );
}
