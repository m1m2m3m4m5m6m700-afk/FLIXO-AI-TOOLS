export type AdminErrorMemoryEntry = {
  id: string;
  event_type: 'execution_error';
  visitor_id: string;
  path: string;
  locale: string;
  tool_id?: string | null;
  success?: boolean | null;
  duration_ms?: number | null;
  error_code?: string | null;
  message?: string | null;
  context?: string | null;
  metadata?: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

const getConfig = () => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secretKey) throw new Error('supabase_error_memory_not_configured');
  return { url, secretKey };
};

const request = async (path: string) => {
  const { url, secretKey } = getConfig();
  const response = await fetch(`${url}${path}`, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`supabase_error_memory_request_failed:http_${response.status}`);
  const body: unknown = text ? JSON.parse(text) : null;
  if (!Array.isArray(body)) throw new Error('supabase_error_memory_invalid_response');
  return body;
};

export const listExecutionErrors = async (limit = 50): Promise<AdminErrorMemoryEntry[]> => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('supabase_error_memory_invalid_limit');
  const body = await request(`/rest/v1/flix_events?event_type=eq.execution_error&select=*&order=occurred_at.desc&limit=${limit}`);
  return body.filter((entry): entry is AdminErrorMemoryEntry => {
    if (!entry || typeof entry !== 'object') return false;
    const value = entry as Record<string, unknown>;
    return value.event_type === 'execution_error' && typeof value.id === 'string' && typeof value.occurred_at === 'string';
  });
};
