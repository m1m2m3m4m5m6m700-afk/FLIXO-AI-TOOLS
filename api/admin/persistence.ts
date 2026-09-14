import { createHash } from 'node:crypto';

type PersistenceConfig = {
  url: string;
  secretKey: string;
};

type FlixEventInput = {
  event_type: 'tool_usage' | 'execution_error' | 'user_feedback' | 'unmet_request';
  visitor_id: string;
  path?: string;
  locale?: string;
  tool_id?: string | null;
  success?: boolean | null;
  duration_ms?: number | null;
  error_code?: string | null;
  message?: string | null;
  feedback_kind?: 'complaint' | 'suggestion' | 'praise' | 'other' | null;
  unmet_request?: string | null;
  context?: string | null;
  metadata?: Record<string, unknown>;
};

type FlixEvent = FlixEventInput & {
  id: string;
  occurred_at: string;
  created_at: string;
};

export type AdminEvidenceInput = {
  assertion_id: string;
  claim_id?: string | null;
  exact_sha: string;
  source: string;
  evaluator: string;
  environment: string;
  status: 'VERIFIED' | 'FAILED' | 'BLOCKED' | 'UNAVAILABLE' | 'STALE' | 'UNKNOWN';
  freshness_at: string;
  payload?: Record<string, unknown>;
  expires_at?: string | null;
};

export type AdminEvidence = AdminEvidenceInput & {
  evidence_id: string;
  recorded_at: string;
  integrity_sha256: string;
  created_at: string;
};

export type AdminAuditInput = {
  actor_subject: string;
  actor_role?: string | null;
  action: string;
  capability?: string | null;
  target_type: string;
  target_id: string;
  exact_sha: string;
  environment: string;
  outcome: string;
  correlation_id?: string | null;
  evidence_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type AdminAuditEvent = AdminAuditInput & {
  event_id: string;
  occurred_at: string;
  integrity_sha256: string;
  created_at: string;
};

const getConfig = (): PersistenceConfig | null => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secretKey) return null;
  return { url, secretKey };
};

const request = async (path: string, init: RequestInit = {}) => {
  const config = getConfig();
  if (!config) throw new Error('supabase_persistence_not_configured');

  const headers = new Headers(init.headers);
  headers.set('apikey', config.secretKey);
  headers.set('Accept', 'application/json');

  const response = await fetch(`${config.url}${path}`, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null && 'message' in body ? String((body as { message?: unknown }).message) : `http_${response.status}`;
    throw new Error(`supabase_request_failed:${detail}`);
  }

  return body;
};

const integritySha256 = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const assertSingleObject = (body: unknown, errorCode: string) => {
  if (!Array.isArray(body) || body.length !== 1 || typeof body[0] !== 'object' || body[0] === null) {
    throw new Error(errorCode);
  }
  return body[0] as Record<string, unknown>;
};

export const isPersistenceConfigured = () => getConfig() !== null;

export const probePersistence = async () => {
  const body = await request('/rest/v1/flix_events?select=id&limit=1', { method: 'GET' });
  if (!Array.isArray(body)) throw new Error('supabase_invalid_probe_response');
  return { reachable: true, table: 'public.flix_events' } as const;
};

export const createEvent = async (input: FlixEventInput): Promise<FlixEvent> => {
  const body = await request('/rest/v1/flix_events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      ...input,
      path: input.path ?? '',
      locale: input.locale ?? '',
      metadata: input.metadata ?? {},
    }),
  });

  const event = assertSingleObject(body, 'supabase_invalid_event_response');
  if (typeof event.id !== 'string') throw new Error('supabase_invalid_event_response');
  return event as unknown as FlixEvent;
};

export const getEvent = async (id: string): Promise<FlixEvent | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const body = await request(`/rest/v1/flix_events?id=eq.${encodeURIComponent(id)}&select=*`, { method: 'GET' });
  if (!Array.isArray(body) || body.length === 0) return null;
  const event = assertSingleObject(body, 'supabase_invalid_event_readback');
  return event as unknown as FlixEvent;
};

export const assertEventRoundTrip = async (input: FlixEventInput) => {
  const created = await createEvent(input);
  const readBack = await getEvent(created.id);
  if (!readBack || readBack.id !== created.id) throw new Error('supabase_event_readback_failed');
  return { created, readBack };
};

export const createEvidence = async (input: AdminEvidenceInput): Promise<AdminEvidence> => {
  const payload = input.payload ?? {};
  const integrity_sha256 = integritySha256({
    assertion_id: input.assertion_id,
    claim_id: input.claim_id ?? null,
    exact_sha: input.exact_sha,
    source: input.source,
    evaluator: input.evaluator,
    environment: input.environment,
    status: input.status,
    freshness_at: input.freshness_at,
    payload,
    expires_at: input.expires_at ?? null,
  });

  const body = await request('/rest/v1/flix_admin_evidence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      ...input,
      claim_id: input.claim_id ?? null,
      payload,
      expires_at: input.expires_at ?? null,
      integrity_sha256,
    }),
  });

  return assertSingleObject(body, 'supabase_invalid_evidence_response') as unknown as AdminEvidence;
};

export const getEvidence = async (id: string): Promise<AdminEvidence | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const body = await request(`/rest/v1/flix_admin_evidence?evidence_id=eq.${encodeURIComponent(id)}&select=*`, { method: 'GET' });
  if (!Array.isArray(body) || body.length === 0) return null;
  return assertSingleObject(body, 'supabase_invalid_evidence_readback') as unknown as AdminEvidence;
};

export const createAuditEvent = async (input: AdminAuditInput): Promise<AdminAuditEvent> => {
  const metadata = input.metadata ?? {};
  const integrity_sha256 = integritySha256({
    actor_subject: input.actor_subject,
    actor_role: input.actor_role ?? null,
    action: input.action,
    capability: input.capability ?? null,
    target_type: input.target_type,
    target_id: input.target_id,
    exact_sha: input.exact_sha,
    environment: input.environment,
    outcome: input.outcome,
    correlation_id: input.correlation_id ?? null,
    evidence_id: input.evidence_id ?? null,
    metadata,
  });

  const body = await request('/rest/v1/flix_admin_audit_events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      ...input,
      actor_role: input.actor_role ?? null,
      capability: input.capability ?? null,
      correlation_id: input.correlation_id ?? null,
      evidence_id: input.evidence_id ?? null,
      metadata,
      integrity_sha256,
    }),
  });

  return assertSingleObject(body, 'supabase_invalid_audit_response') as unknown as AdminAuditEvent;
};

export const getAuditEvent = async (id: string): Promise<AdminAuditEvent | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const body = await request(`/rest/v1/flix_admin_audit_events?event_id=eq.${encodeURIComponent(id)}&select=*`, { method: 'GET' });
  if (!Array.isArray(body) || body.length === 0) return null;
  return assertSingleObject(body, 'supabase_invalid_audit_readback') as unknown as AdminAuditEvent;
};

export const assertAdminEvidenceRoundTrip = async (input: AdminEvidenceInput, audit: Omit<AdminAuditInput, 'evidence_id'>) => {
  const evidence = await createEvidence(input);
  const auditEvent = await createAuditEvent({ ...audit, evidence_id: evidence.evidence_id });
  const evidenceReadBack = await getEvidence(evidence.evidence_id);
  const auditReadBack = await getAuditEvent(auditEvent.event_id);

  if (!evidenceReadBack || evidenceReadBack.evidence_id !== evidence.evidence_id) {
    throw new Error('supabase_evidence_readback_failed');
  }
  if (!auditReadBack || auditReadBack.event_id !== auditEvent.event_id) {
    throw new Error('supabase_audit_readback_failed');
  }
  if (auditReadBack.evidence_id !== evidenceReadBack.evidence_id) {
    throw new Error('supabase_audit_evidence_link_failed');
  }

  return { evidence, evidenceReadBack, auditEvent, auditReadBack };
};
