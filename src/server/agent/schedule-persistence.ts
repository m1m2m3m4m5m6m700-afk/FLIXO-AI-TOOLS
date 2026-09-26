import { advanceScheduledAgentJob, type ScheduledAgentJob } from '@/lib/agent/scheduler.ts';

type PersistenceConfig = Readonly<{ url: string; key: string }>;

function config(): PersistenceConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\\/$/u, '');
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) return null;
  return { url, key };
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const cfg = config();
  if (!cfg) throw new Error('AGENT_SCHEDULE_PERSISTENCE_NOT_CONFIGURED');
  const headers = new Headers(init.headers);
  headers.set('apikey', cfg.key);
  headers.set('Authorization', \`Bearer \${cfg.key}\`);
  headers.set('Accept', 'application/json');
  const response = await fetch(\`\${cfg.url}\${path}\`, { ...init, headers });
  const bodyText = await response.text();
  let body: unknown = null;
  if (bodyText) {
    try { body = JSON.parse(bodyText); } catch { body = bodyText; }
  }
  if (!response.ok) throw new Error(\`AGENT_SCHEDULE_PERSISTENCE_FAILED:http_\${response.status}\`);
  return body;
}

export const isAgentSchedulePersistenceConfigured = () => config() !== null;

function rowToJob(row: Record<string, unknown>): ScheduledAgentJob {
  return {
    scheduleId: String(row.schedule_id),
    ownerId: String(row.owner_id),
    conversationId: row.conversation_id == null ? null : String(row.conversation_id),
    locale: String(row.locale),
    prompt: String(row.prompt),
    nextRunAt: String(row.next_run_at),
    intervalSeconds: row.interval_seconds == null ? null : Number(row.interval_seconds),
    maxRuns: row.max_runs == null ? null : Number(row.max_runs),
    runCount: Number(row.run_count ?? 0),
    active: Boolean(row.active),
    lastRunAt: row.last_run_at == null ? null : String(row.last_run_at),
    lastEventId: row.last_event_id == null ? null : String(row.last_event_id),
    leaseUntil: row.lease_until == null ? null : String(row.lease_until),
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {},
  };
}

export async function createPersistedSchedule(job: ScheduledAgentJob): Promise<ScheduledAgentJob> {
  const body = await request('/rest/v1/flixo_agent_schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      schedule_id: job.scheduleId,
      owner_id: job.ownerId,
      conversation_id: job.conversationId,
      locale: job.locale,
      prompt: job.prompt,
      next_run_at: job.nextRunAt,
      interval_seconds: job.intervalSeconds,
      max_runs: job.maxRuns,
      run_count: job.runCount,
      active: job.active,
      last_run_at: job.lastRunAt,
      last_event_id: job.lastEventId,
      lease_until: job.leaseUntil,
      metadata: job.metadata,
    }),
  });
  if (!Array.isArray(body) || !body[0] || typeof body[0] !== 'object') throw new Error('AGENT_SCHEDULE_CREATE_RESPONSE_INVALID');
  return rowToJob(body[0] as Record<string, unknown>);
}

export async function claimDueSchedules(limit = 16, now = new Date().toISOString()): Promise<readonly ScheduledAgentJob[]> {
  const body = await request('/rest/v1/rpc/flixo_claim_due_agent_schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: limit, p_now: now }),
  });
  if (!Array.isArray(body)) throw new Error('AGENT_SCHEDULE_CLAIM_RESPONSE_INVALID');
  return Object.freeze(body.filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === 'object')
  ).map(rowToJob));
}

export async function markScheduleRun(job: ScheduledAgentJob, ranAt: string, eventId: string): Promise<ScheduledAgentJob> {
  const next = advanceScheduledAgentJob(job, ranAt, eventId);
  const body = await request(\`/rest/v1/flixo_agent_schedules?schedule_id=eq.\${encodeURIComponent(job.scheduleId)}\`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      active: next.active,
      next_run_at: next.nextRunAt,
      run_count: next.runCount,
      last_run_at: next.lastRunAt,
      last_event_id: next.lastEventId,
      lease_until: null,
      metadata: next.metadata,
    }),
  });
  if (!Array.isArray(body) || !body[0] || typeof body[0] !== 'object') throw new Error('AGENT_SCHEDULE_UPDATE_RESPONSE_INVALID');
  return rowToJob(body[0] as Record<string, unknown>);
}
