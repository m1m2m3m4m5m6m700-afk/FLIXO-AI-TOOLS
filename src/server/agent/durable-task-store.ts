import type { AgentTaskRecord } from '@/lib/agent/agent-task-manager';
import type { AgentEventEnvelope } from '@/lib/agent/event-gateway';

type PersistedTaskRow = {
  task_id: string;
  conversation_id: string;
  owner_id: string;
  lifecycle: AgentTaskRecord['lifecycle'];
  state: AgentTaskRecord['context']['state'];
  revision: number;
  confirmation_required: boolean;
  resume_count: number;
  request: string | null;
  plan: unknown | null;
  runtime: unknown | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type PersistedEventRow = {
  event_id: string;
  task_id: string;
  sequence: number;
  event_type: string;
  source: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  previous_hash: string | null;
  hash: string;
  occurred_at: string;
};

const config = () => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return url && secretKey ? { url, secretKey } : null;
};

async function rest(path: string, init: RequestInit = {}): Promise<unknown> {
  const value = config();
  if (!value) throw new Error('agent_task_store_not_configured');

  const headers = new Headers(init.headers);
  headers.set('apikey', value.secretKey);
  headers.set('Authorization', 'Bearer ' + value.secretKey);
  headers.set('Accept', 'application/json');

  const response = await fetch(value.url + path, { ...init, headers });
  const text = await response.text();
  if (!response.ok) throw new Error('agent_task_store_request_failed:http_' + response.status);
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function singleRow<T>(body: unknown): T {
  if (!Array.isArray(body) || body.length !== 1 || typeof body[0] !== 'object' || body[0] === null) {
    throw new Error('agent_task_store_invalid_response');
  }
  return body[0] as T;
}

export function isDurableAgentTaskStoreConfigured(): boolean {
  return config() !== null;
}

export async function upsertAgentTask(input: {
  taskId: string;
  conversationId: string;
  ownerId: string;
  lifecycle: AgentTaskRecord['lifecycle'];
  state: AgentTaskRecord['context']['state'];
  revision: number;
  confirmationRequired: boolean;
  resumeCount?: number;
  request?: string | null;
  plan?: unknown | null;
  runtime?: unknown | null;
  lastError?: string | null;
}): Promise<PersistedTaskRow> {
  const body = await rest('/rest/v1/flixo_agent_tasks?on_conflict=task_id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      task_id: input.taskId,
      conversation_id: input.conversationId,
      owner_id: input.ownerId,
      lifecycle: input.lifecycle,
      state: input.state,
      revision: input.revision,
      confirmation_required: input.confirmationRequired,
      resume_count: input.resumeCount ?? 0,
      request: input.request ?? null,
      plan: input.plan ?? null,
      runtime: input.runtime ?? null,
      last_error: input.lastError ?? null,
    }),
  });
  return singleRow<PersistedTaskRow>(body);
}

export async function appendAgentTaskEvent(event: AgentEventEnvelope): Promise<PersistedEventRow | null> {
  if (!event.taskId) throw new Error('agent_task_event_requires_task_id');
  const body = await rest('/rest/v1/rpc/flixo_append_agent_task_event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      p_event_id: event.eventId,
      p_task_id: event.taskId,
      p_event_type: event.eventType,
      p_source: event.source,
      p_idempotency_key: event.idempotencyKey,
      p_payload: event.payload,
      p_occurred_at: event.occurredAt,
    }),
  });
  if (body == null || (Array.isArray(body) && body.length === 0)) return null;
  return Array.isArray(body) ? singleRow<PersistedEventRow>(body) : body as PersistedEventRow;
}

export async function getAgentTask(taskId: string): Promise<PersistedTaskRow | null> {
  const body = await rest('/rest/v1/flixo_agent_tasks?task_id=eq.' + encodeURIComponent(taskId) + '&select=*');
  if (!Array.isArray(body) || body.length === 0) return null;
  return singleRow<PersistedTaskRow>(body);
}

export async function listAgentTaskEvents(taskId: string, limit = 500): Promise<readonly PersistedEventRow[]> {
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 5_000) : 500;
  const body = await rest(
    '/rest/v1/flixo_agent_task_events?task_id=eq.'
      + encodeURIComponent(taskId)
      + '&select=*&order=sequence.asc&limit='
      + boundedLimit,
  );
  if (!Array.isArray(body)) throw new Error('agent_task_store_invalid_events_response');
  return Object.freeze(body as PersistedEventRow[]);
}

export async function getAgentTaskReplay(taskId: string, limit = 500): Promise<Readonly<{
  task: PersistedTaskRow | null;
  events: readonly PersistedEventRow[];
}>> {
  const [task, events] = await Promise.all([
    getAgentTask(taskId),
    listAgentTaskEvents(taskId, limit),
  ]);
  return Object.freeze({ task, events });
}
