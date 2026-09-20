import { createHash } from 'node:crypto';
import type { AdminSession } from './boundary.ts';

type SessionRecord = {
  session_id: string;
  actor_subject: string;
  actor_role: string;
  environment: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

const config = () => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secretKey) return null;
  return { url, secretKey };
};

const request = async (path: string, init: RequestInit = {}) => {
  const value = config();
  if (!value) throw new Error('admin_session_store_not_configured');
  const headers = new Headers(init.headers);
  headers.set('apikey', value.secretKey);
  headers.set('Authorization', `Bearer ${value.secretKey}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(`${value.url}${path}`, { ...init, headers });
  const bodyText = await response.text();
  let body: unknown = null;
  if (bodyText) {
    try { body = JSON.parse(bodyText); } catch { body = bodyText; }
  }
  if (!response.ok) {
    throw new Error(`admin_session_store_request_failed:http_${response.status}`);
  }
  return body;
};

const assertSingle = (body: unknown): SessionRecord => {
  if (!Array.isArray(body) || body.length !== 1 || typeof body[0] !== 'object' || body[0] === null) {
    throw new Error('admin_session_store_invalid_response');
  }
  return body[0] as SessionRecord;
};

export const isAdminSessionStoreConfigured = () => config() !== null;

export const persistAdminSession = async (
  session: AdminSession,
  input: { environment: string; issuedAt: string; token: string },
) => {
  if (!session.sessionId) throw new Error('admin_session_id_missing');
  const body = await request('/rest/v1/flix_admin_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      token_hash: createHash('sha256').update(input.token).digest('hex'),
      session_id: session.sessionId,
      actor_subject: session.subject,
      actor_role: session.role ?? 'ADMIN',
      environment: input.environment,
      issued_at: input.issuedAt,
      expires_at: new Date(session.expiresAt * 1000).toISOString(),
    }),
  });
  const persisted = assertSingle(body);
  if (persisted.session_id !== session.sessionId || persisted.actor_subject !== session.subject || persisted.environment !== input.environment) {
    throw new Error('admin_session_persistence_identity_mismatch');
  }
  return persisted;
};

export const getAdminSessionRecord = async (sessionId: string): Promise<SessionRecord | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const body = await request(
    `/rest/v1/flix_admin_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
  );
  if (!Array.isArray(body) || body.length === 0) return null;
  return assertSingle(body);
};

export const isAdminSessionRevoked = async (sessionId: string, nowMs = Date.now()) => {
  const record = await getAdminSessionRecord(sessionId);
  if (!record) return 'MISSING' as const;
  if (record.revoked_at) return 'REVOKED' as const;
  if (Date.parse(record.expires_at) <= nowMs) return 'EXPIRED' as const;
  return 'ACTIVE' as const;
};

export const revokeAdminSession = async (sessionId: string, revokedAt = new Date().toISOString()) => {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('admin_session_id_invalid');
  const body = await request(
    `/rest/v1/flix_admin_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ revoked_at: revokedAt }),
    },
  );
  return assertSingle(body);
};
