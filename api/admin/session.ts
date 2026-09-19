import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildAdminClearCookie,
  buildAdminSessionCookie,
  readAdminSessionToken,
  sessionCookieName,
  signAdminSession,
  verifyAdminSessionToken,
} from './boundary.ts';
import { verifyAdminPassword } from './credentials.ts';
import { activeCapabilitiesForRole } from '../../src/lib/admin/roles.ts';
import { persistAdminSession, revokeAdminSession, isAdminSessionStoreConfigured, getAdminSessionRecord } from './session-store.ts';

type AdminRequest = IncomingMessage & { body?: unknown };
type BodyRecord = Record<string, unknown>;

const LOGIN_TTL_SECONDS = 60 * 60;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 60_000;
const loginBuckets = new Map<string, { attempts: number; resetAt: number }>();

const json = (res: ServerResponse, status: number, body: unknown, correlationId: string, extraHeaders: Record<string, string> = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', correlationId);
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
};

const headerValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

const correlationIdFor = (req: AdminRequest) => {
  const supplied = headerValue(req.headers['x-request-id']);
  return typeof supplied === 'string' && supplied.trim().length > 0 && supplied.trim().length <= 128
    ? supplied.trim()
    : randomUUID();
};

const clientIpFor = (req: AdminRequest) => {
  const forwarded = headerValue(req.headers['x-forwarded-for']);
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headerValue(req.headers['x-real-ip']);
  return real && real.trim() ? real.trim() : 'unknown';
};

const allowMutationOrigin = (req: AdminRequest) => {
  const origin = headerValue(req.headers.origin);
  if (!origin || origin.trim() === '') return true;

  const host = headerValue(req.headers.host);
  if (!host || !host.trim()) return false;

  const forwardedProto = headerValue(req.headers['x-forwarded-proto']);
  const protocol = forwardedProto && forwardedProto.trim()
    ? forwardedProto.split(',')[0].trim()
    : process.env.NODE_ENV === 'production' ? 'https' : 'http';

  return origin === `${protocol}://${host}`;
};

const rateAllowed = (ip: string) => {
  const now = Date.now();
  const current = loginBuckets.get(ip);
  if (!current || now >= current.resetAt) {
    loginBuckets.set(ip, { attempts: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (current.attempts >= LOGIN_LIMIT) return false;
  current.attempts += 1;
  return true;
};

const parseBody = async (req: AdminRequest): Promise<BodyRecord | null> => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body as BodyRecord;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    try {
      const parsed = JSON.parse(String(req.body));
      return parsed && typeof parsed === 'object' ? parsed as BodyRecord : null;
    } catch {
      return null;
    }
  }

  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req as AsyncIterable<Buffer | string>) chunks.push(Buffer.from(chunk));
  } catch {
    return null;
  }
  if (chunks.length === 0) return null;
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed as BodyRecord : null;
  } catch {
    return null;
  }
};

const configured = () => {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  return Boolean(secret && secret.length >= 32 && hash);
};

const fail = (res: ServerResponse, status: 400 | 401 | 403 | 405 | 429 | 503, code: string, correlationId: string) =>
  json(res, status, { ok: false, error: { code, correlationId } }, correlationId);

export default async function adminSession(req: AdminRequest, res: ServerResponse) {
  const correlationId = correlationIdFor(req);
  const method = String(req.method ?? 'GET').toUpperCase();

  if (method === 'GET') {
    if (!configured()) return fail(res, 503, 'server_configuration_unavailable', correlationId);

    const session = verifyAdminSessionToken(readAdminSessionToken(req.headers.cookie));
    if (!session) return fail(res, 401, 'authentication_required', correlationId);
    if (!session.sessionId) return fail(res, 401, 'authentication_required', correlationId);
    if (!isAdminSessionStoreConfigured()) return fail(res, 503, 'session_store_unavailable', correlationId);
    let record: Awaited<ReturnType<typeof getAdminSessionRecord>>;
    try {
      record = await getAdminSessionRecord(session.sessionId);
      if (!record || record.revoked_at || Date.parse(record.expires_at) <= Date.now()) return fail(res, 401, 'authentication_required', correlationId);
    } catch {
      return fail(res, 503, 'session_store_unavailable', correlationId);
    }

    return json(res, 200, {
      ok: true,
      authenticated: true,
      identity: { subject: session.subject, role: session.role ?? 'ADMIN' },
      capabilities: [...session.capabilities],
      expiresAt: session.expiresAt,
      provenance: {
        sessionId: session.sessionId,
        environment: record?.environment ?? 'unknown',
      },
      correlationId,
    }, correlationId);
  }

  if (method === 'POST') {
    if (!allowMutationOrigin(req)) return fail(res, 403, 'csrf_origin_denied', correlationId);
    if (!configured()) return fail(res, 503, 'server_configuration_unavailable', correlationId);
    if (!rateAllowed(clientIpFor(req))) return fail(res, 429, 'login_rate_limited', correlationId);

    const body = await parseBody(req);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 256) return fail(res, 400, 'invalid_credentials_payload', correlationId);
    if (!verifyAdminPassword(password)) return fail(res, 401, 'invalid_credentials', correlationId);

    const sessionId = randomUUID();
    const role = 'OWNER' as const;
    const capabilities = activeCapabilitiesForRole(role);
    const token = signAdminSession({
      subject: 'owner',
      role,
      sessionId,
      capabilities: [...capabilities],
      ttlSeconds: LOGIN_TTL_SECONDS,
    });

    try {
      await persistAdminSession(verifyAdminSessionToken(token)!, {
        environment: process.env.VERCEL_ENV ?? 'unknown',
        issuedAt: new Date().toISOString(),
        token,
      });
    } catch {
      return fail(res, 503, 'session_store_unavailable', correlationId);
    }

    return json(res, 200, {
      ok: true,
      authenticated: true,
      identity: { subject: 'owner', role: 'OWNER' },
      expiresIn: LOGIN_TTL_SECONDS,
      correlationId,
    }, correlationId, {
      'Set-Cookie': buildAdminSessionCookie(token, LOGIN_TTL_SECONDS),
    });
  }

  if (method === 'DELETE') {
    if (!allowMutationOrigin(req)) return fail(res, 403, 'csrf_origin_denied', correlationId);
    if (!configured()) return fail(res, 503, 'server_configuration_unavailable', correlationId);

    const session = verifyAdminSessionToken(readAdminSessionToken(req.headers.cookie));
    if (!session) return fail(res, 401, 'authentication_required', correlationId);
    if (!session.sessionId) return fail(res, 401, 'authentication_required', correlationId);
    if (!isAdminSessionStoreConfigured()) return fail(res, 503, 'session_store_unavailable', correlationId);
    try {
      await revokeAdminSession(session.sessionId);
    } catch {
      return fail(res, 503, 'session_store_unavailable', correlationId);
    }

    return json(res, 200, {
      ok: true,
      authenticated: false,
      correlationId,
    }, correlationId, {
      'Set-Cookie': buildAdminClearCookie(),
    });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return fail(res, 405, 'method_not_allowed', correlationId);
}

export { sessionCookieName };
