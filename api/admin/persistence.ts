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

  if (!Array.isArray(body) || body.length !== 1 || typeof body[0] !== 'object' || body[0] === null || typeof (body[0] as { id?: unknown }).id !== 'string') {
    throw new Error('supabase_invalid_event_response');
  }

  return body[0] as FlixEvent;
};

export const getEvent = async (id: string): Promise<FlixEvent | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const body = await request(`/rest/v1/flix_events?id=eq.${encodeURIComponent(id)}&select=*`, { method: 'GET' });
  if (!Array.isArray(body) || body.length === 0) return null;
  if (body.length !== 1 || typeof body[0] !== 'object' || body[0] === null) throw new Error('supabase_invalid_event_readback');
  return body[0] as FlixEvent;
};

export const assertEventRoundTrip = async (input: FlixEventInput) => {
  const created = await createEvent(input);
  const readBack = await getEvent(created.id);
  if (!readBack || readBack.id !== created.id) throw new Error('supabase_event_readback_failed');
  return { created, readBack };
};
