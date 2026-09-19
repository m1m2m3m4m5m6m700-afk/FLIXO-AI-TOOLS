import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isAdminSessionStoreConfigured, isAdminSessionRevoked } from './session-store.ts';

const SESSION_COOKIE = 'flixo_admin_session';
const DEFAULT_TTL_SECONDS = 60 * 60;

const BOUNDARY_CAPABILITY = 'admin.read' as const;

type AdminRequest = IncomingMessage & {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type SessionInput = {
  subject: string;
  capabilities: string[];
  role?: string;
  sessionId?: string;
  ttlSeconds?: number;
};

export type AdminSession = {
  subject: string;
  sessionId?: string;
  capabilities: Set<string>;
  role?: string;
  expiresAt: number;
};

export type AdminAuthorization = {
  subject: string;
  capability: string;
  correlationId: string;
};

export type AdminAuthorizationFailure = {
  status: 401 | 403 | 405 | 503;
  code: string;
  correlationId: string;
};

const json = (res: ServerResponse, status: number, body: unknown, correlationId: string) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', correlationId);
  res.end(JSON.stringify(body));
};

const errorResponse = (res: ServerResponse, status: number, code: string, correlationId: string) =>
  json(res, status, { ok: false, error: { code, correlationId } }, correlationId);

const base64url = (value: string) => Buffer.from(value).toString('base64url');
const fromBase64url = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const sessionSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
};

export const signAdminSession = ({ subject, capabilities, role, sessionId, ttlSeconds = DEFAULT_TTL_SECONDS }: SessionInput, secret = process.env.ADMIN_SESSION_SECRET) => {
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET is not configured');
  if (!subject || !Array.isArray(capabilities)) throw new Error('invalid session payload');

  const payload = {
    sub: subject,
    role,
    sid: sessionId,
    cap: [...new Set(capabilities)].sort(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};

export const verifyAdminSessionToken = (token: string | null, secret = process.env.ADMIN_SESSION_SECRET): AdminSession | null => {
  if (!secret || secret.length < 32) return null;
  if (!token) return null;
  const [encoded, providedSignature] = token.split('.');
  if (!encoded || !providedSignature) return null;

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest();
  const actualSignature = Buffer.from(providedSignature, 'base64url');
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(fromBase64url(encoded)) as { sub?: string; role?: string; sid?: string; cap?: unknown; exp?: number };
    if (!payload.sub || !Array.isArray(payload.cap) || typeof payload.exp !== 'number' || !Number.isInteger(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { subject: payload.sub, sessionId: typeof payload.sid === 'string' ? payload.sid : undefined, role: typeof payload.role === 'string' ? payload.role : undefined, expiresAt: payload.exp, capabilities: new Set(payload.cap.filter((value): value is string => typeof value === 'string')) };
  } catch {
    return null;
  }
};

export const readAdminSessionToken = (cookieHeader: string | undefined) => readCookie(cookieHeader, SESSION_COOKIE);

export const buildAdminSessionCookie = (token: string, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.max(1, Math.floor(ttlSeconds))}; HttpOnly; SameSite=Lax${secure}`;
};

export const buildAdminClearCookie = () => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
};

const readCookie = (cookieHeader: string | undefined, name: string) => {
  for (const part of String(cookieHeader ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
};


export const authorizeAdminRequestWithDurableSession = async (
  req: AdminRequest,
  requiredCapability = 'admin.read',
): Promise<AdminAuthorization | AdminAuthorizationFailure> => {
  const authorization = authorizeAdminRequest(req, requiredCapability);
  if ('status' in authorization) return authorization;

  const token = readAdminSessionToken(req.headers.cookie);
  const session = verifyAdminSessionToken(token);
  if (!session?.sessionId) {
    return authorization;
  }

  if (!isAdminSessionStoreConfigured()) {
    return { status: 503, code: 'session_store_unavailable', correlationId: authorization.correlationId };
  }

  let state: Awaited<ReturnType<typeof isAdminSessionRevoked>>;
  try {
    state = await isAdminSessionRevoked(session.sessionId);
  } catch {
    return { status: 503, code: 'session_store_unavailable', correlationId: authorization.correlationId };
  }

  if (state !== 'ACTIVE') {
    return { status: 401, code: 'authentication_required', correlationId: authorization.correlationId };
  }

  return authorization;
};

export const authorizeAdminRequest = (req: AdminRequest, requiredCapability = 'admin.read'): AdminAuthorization | AdminAuthorizationFailure => {
  const suppliedRequestId = req.headers['x-request-id'];
  const correlationId = typeof suppliedRequestId === 'string' && suppliedRequestId.trim().length <= 128 && suppliedRequestId.trim().length > 0 ? suppliedRequestId : randomUUID();
  const method = String(req.method ?? 'GET').toUpperCase();

  if (method !== 'GET') return { status: 405, code: 'method_not_allowed', correlationId };

  const secret = sessionSecret();
  if (!secret) return { status: 503, code: 'server_configuration_unavailable', correlationId };

  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  const session = verifyAdminSessionToken(token, secret);
  if (!session) return { status: 401, code: 'authentication_required', correlationId };

  if (!requiredCapability || !session.capabilities.has(requiredCapability)) {
    return { status: 403, code: 'capability_denied', correlationId };
  }

  return {
    subject: session.subject,
    capability: requiredCapability,
    correlationId,
  };
};

export default async function adminBoundary(req: AdminRequest, res: ServerResponse) {
  const requestedCapability = req.query?.capability;
  const capability = Array.isArray(requestedCapability) ? requestedCapability[0] : requestedCapability;
  const authorization = await authorizeAdminRequestWithDurableSession(req, BOUNDARY_CAPABILITY);

  console.info(JSON.stringify({ event: 'admin_boundary_request', correlationId: authorization.correlationId, method: String(req.method ?? 'GET').toUpperCase() }));

  if ('status' in authorization) {
    if (authorization.status === 405) res.setHeader('Allow', 'GET');
    return errorResponse(res, authorization.status, authorization.code, authorization.correlationId);
  }

  // The boundary exposes only its fixed capability. A caller cannot use the query string to probe or elevate another capability.
  if (capability && capability !== BOUNDARY_CAPABILITY) {
    return errorResponse(res, 403, 'capability_denied', authorization.correlationId);
  }

  return json(res, 200, {
    ok: true,
    identity: { subject: authorization.subject },
    authorization: { capability: authorization.capability, decision: 'ALLOW' },
    correlationId: authorization.correlationId,
  }, authorization.correlationId);
}

export const sessionCookieName = SESSION_COOKIE;
