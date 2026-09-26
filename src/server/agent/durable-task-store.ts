import { createHash } from 'node:crypto';
import type { AgentTaskRecord } from '@/lib/agent/agent-task-manager';
import type { AgentEventEnvelope } from '@/lib/agent/event-envelope';

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

const config = () => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return url && secretKey ? { url, secretKey } : null;
};

const request = async (path: string, init: RequestInit = {}) => {
  const value = config();
  if (!value) throw new Error('agent_task_store_not_configured');
  const headers = new Headers(init.headers);
  headers.set('apikey', value.secretKey);
  headers.set('Authorization', 'Bearer ' + value.secretKey);
  headers.set('Accept', 'application/json');
  const response = await fetch(value.url + path, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) throw new Error('agent_task_store_request_failed:http_' + response.status);
  return body;
};

function assertSingle(body: unknown): PersistedTaskRow {
  if (!Array.isArray(body) || body.length !== 1 || typeof body[0] !== 'object' || body[0] === null) {
    throw new Error('agent_task_store_invalid_response');
  }
  return body[0] as PersistedTaskRow;
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
  const body = await request('/rest/v1/flixo_agent_tasks?on_conflict=task_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
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
  return assertSingle(body);
}

export async function appendAgentTaskEvent(event: AgentEventEnvelope): Promise<void> {
  const current = await request(
    '/rest/v1/flixo_agent_task_events?task_id=eq.' + encodeURIComponent(event.taskId ?? '') + '&select=sequence,hash&order=sequence.desc&limit=1',
  );
  const previous = Array.isArray(current) && current[0] ? current[0] as { sequence: number; hash: string } : null;
  const sequence = (previous?.sequence ?? 0) + 1;
  const base = {
    event_id: event.eventId,
    task_id: event.taskId,
    sequence,
    event_type: event.type,
    source: event.source,
    idempotency_key: event.idempotencyKey,
    payload: event.payload,
    previous_hash: previous?.hash ?? null,
    occurred_at: event.occurredAt,
  };
  const hash = createHash('sha256').update(JSON.stringify(base)).digest('hex');
  await request('/rest/v1/flixo_agent_task_events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ...base, hash }),
  });
}

export async function getAgentTask(taskId: string): Promise<PersistedTaskRow | null> {
  const body = await request('/rest/v1/flixo_agent_tasks?task_id=eq.' + encodeURIComponent(taskId) + '&select=*');
  if (!Array.isArray(body) || body.length === 0) return null;
  return assertSingle(body);
}
