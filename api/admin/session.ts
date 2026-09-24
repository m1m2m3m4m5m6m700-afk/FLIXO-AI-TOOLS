import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  AdminErrorResponse,
  AdminLoginRequest,
  AdminRequestQuery,
  AdminSessionGetResponse,
  AdminSessionLoginResponse,
  AdminSessionLogoutResponse,
} from '../contracts.ts';
import {
  buildAdminClearCookie,
  buildAdminSessionCookie,
  readAdminSessionToken,
  sessionCookieName,
  signAdminSession,
  verifyAdminSessionToken,
} from './boundary.ts';
import { verifyAdminPassword } from '../../src/server/admin/credentials.ts';
import { activeCapabilitiesForRole } from '../../src/lib/admin/roles.ts';
import { persistAdminSession, revokeAdminSession, isAdminSessionStoreConfigured, getAdminSessionState, getAdminSessionRecord } from '../../src/server/admin/session-store.ts';

interface AdminRequest extends IncomingMessage {
  body?: unknown;
  query?: AdminRequestQuery;
}

interface BodyGuard<TBody> {
  (value: unknown): value is TBody;
}

const LOGIN_TTL_SECONDS = 60 * 60;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 60_000;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const loginBuckets = new Map<string, { attempts: number; resetAt: number }>();

const json = <
  TBody extends AdminErrorResponse
    | AdminSessionGetResponse
    | AdminSessionLoginResponse
    | AdminSessionLogoutResponse
>(
  res: ServerResponse,
  status: number,
  body: TBody,
  correlationId: string,
  extraHeaders: Record<string, string> = {},
): void => {
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

const trustedProxyHeaders = () =>
  process.env.FLIXO_TRUST_PROXY_HEADERS === 'true'
  || process.env.VERCEL === '1';

const clientIpFor = (req: AdminRequest) => {
  if (!trustedProxyHeaders()) return 'unknown';
  const forwarded = headerValue(req.headers['x-forwarded-for']);
  if (forwarded) {
    const first = forwarded.split(',').map((value) => value.trim()).filter(Boolean)[0];
    if (first) return first;
  }
  const real = headerValue(req.headers['x-real-ip']);
  return real && real.trim() ? real.trim() : 'unknown';
};

const allowMutationOrigin = (req: AdminRequest) => {
  const origin = headerValue(req.headers.origin)?.trim();
  const isProduction = process.env.NODE_ENV === 'production';
  if (!origin) return !isProduction;

  const configuredOrigin = process.env.ADMIN_PUBLIC_ORIGIN?.trim().replace(/\/$/, '');
  if (isProduction) return Boolean(configuredOrigin && origin === configuredOrigin);

  const host = headerValue(req.headers.host)?.trim();
  return Boolean(host && origin === 'http://' + host);
};

const rateAllowed = (ip: string) => {
  const now = Date.now();
  const current = loginBuckets.get(ip);
  if (loginBuckets.size > 10_000) {
    for (const [key, bucket] of loginBuckets) {
      if (now >= bucket.resetAt) loginBuckets.delete(key);
    }
  }
  if (!current || now >= current.resetAt) {
    loginBuckets.set(ip, { attempts: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (current.attempts >= LOGIN_LIMIT) return false;
  current.attempts += 1;
  return true;
};

const isAdminLoginRequest = (value: unknown): value is AdminLoginRequest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (!('password' in value)) return false;
  return typeof value.password === 'string';
};

const parseBody = async <TBody>(
  req: AdminRequest,
  guard: BodyGuard<TBody>,
): Promise<TBody | null> => {
  const declaredLength = headerValue(req.headers['content-length']);
  if (declaredLength !== undefined) {
    const size = Number(declaredLength);
    if (!Number.isFinite(size) || size < 0 || size > MAX_REQUEST_BODY_BYTES) return null;
  }
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return guard(req.body) ? req.body : null;
  }
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    const bodySize = Buffer.byteLength(String(req.body), 'utf8');
    if (bodySize > MAX_REQUEST_BODY_BYTES) return null;
    try {
      const parsed: unknown = JSON.parse(String(req.body));
      return guard(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      const buffer = Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) return null;
      chunks.push(buffer);
    }
  } catch {
    return null;
  }
  if (chunks.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return guard(parsed) ? parsed : null;
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
      const state = await getAdminSessionState(session.sessionId, {
        token: readAdminSessionToken(req.headers.cookie) ?? undefined,
        subject: session.subject,
        role: session.role,
      });
      if (state !== 'ACTIVE') return fail(res, 401, 'authentication_required', correlationId);
      record = await getAdminSessionRecord(session.sessionId);
      if (!record) return fail(res, 401, 'authentication_required', correlationId);
    } catch {
      return fail(res, 503, 'session_store_unavailable', correlationId);
    }

    if (!session.role || !session.sessionId) return fail(res, 401, 'authentication_required', correlationId);

    const response: AdminSessionGetResponse = {
      ok: true,
      authenticated: true,
      identity: { subject: session.subject, role: session.role },
      capabilities: [...session.capabilities],
      expiresAt: session.expiresAt,
      provenance: {
        sessionId: session.sessionId,
        environment: record?.environment ?? 'unknown',
      },
      correlationId,
    };

    return json(res, 200, response, correlationId);
  }

  if (method === 'POST') {
    if (!allowMutationOrigin(req)) return fail(res, 403, 'csrf_origin_denied', correlationId);
    if (!configured()) return fail(res, 503, 'server_configuration_unavailable', correlationId);
    if (!rateAllowed(clientIpFor(req))) return fail(res, 429, 'login_rate_limited', correlationId);

    const body = await parseBody(req, isAdminLoginRequest);
    const password = body?.password ?? '';
    if (!password || password.length > 256) return fail(res, 400, 'invalid_credentials_payload', correlationId);
    if (!verifyAdminPassword(password)) return fail(res, 401, 'invalid_credentials', correlationId);

    const sessionId = randomUUID();
    const role = 'OWNER' as const;
    const capabilities = activeCapabilitiesForRole(role);
    const token = signAdminSession({
      subject: 'owner',
      role,
      sessionId,
      capabilities,
      ttlSeconds: LOGIN_TTL_SECONDS,
    });
    const verifiedSession = verifyAdminSessionToken(token);
    if (!verifiedSession) return fail(res, 503, 'server_configuration_unavailable', correlationId);

    try {
      await persistAdminSession(verifiedSession, {
        environment: process.env.VERCEL_ENV ?? 'unknown',
        issuedAt: new Date().toISOString(),
        token,
      });
    } catch {
      return fail(res, 503, 'session_store_unavailable', correlationId);
    }

    const response: AdminSessionLoginResponse = {
      ok: true,
      authenticated: true,
      identity: { subject: 'owner', role: 'OWNER' },
      expiresIn: LOGIN_TTL_SECONDS,
      correlationId,
    };

    return json(res, 200, response, correlationId, {
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

    const response: AdminSessionLogoutResponse = {
      ok: true,
      authenticated: false,
      correlationId,
    };

    return json(res, 200, response, correlationId, {
      'Set-Cookie': buildAdminClearCookie(),
    });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return fail(res, 405, 'method_not_allowed', correlationId);
}

export { sessionCookieName };
