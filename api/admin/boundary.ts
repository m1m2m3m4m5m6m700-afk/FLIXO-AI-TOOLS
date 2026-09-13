import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const SESSION_COOKIE = 'flixo_admin_session';
const DEFAULT_TTL_SECONDS = 60 * 60;

type AdminRequest = IncomingMessage & {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type SessionInput = {
  subject: string;
  capabilities: string[];
  ttlSeconds?: number;
};

type Session = {
  subject: string;
  capabilities: Set<string>;
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

export const signAdminSession = ({ subject, capabilities, ttlSeconds = DEFAULT_TTL_SECONDS }: SessionInput, secret = process.env.ADMIN_SESSION_SECRET) => {
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET is not configured');
  if (!subject || !Array.isArray(capabilities)) throw new Error('invalid session payload');

  const payload = {
    sub: subject,
    cap: [...new Set(capabilities)].sort(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};

const verifyAdminSession = (token: string | null, secret: string): Session | null => {
  if (!token) return null;
  const [encoded, providedSignature] = token.split('.');
  if (!encoded || !providedSignature) return null;

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest();
  const actualSignature = Buffer.from(providedSignature, 'base64url');
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(fromBase64url(encoded)) as { sub?: string; cap?: unknown; exp?: number };
    if (!payload.sub || !Array.isArray(payload.cap) || !Number.isInteger(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { subject: payload.sub, capabilities: new Set(payload.cap.filter((value): value is string => typeof value === 'string')) };
  } catch {
    return null;
  }
};

const readCookie = (cookieHeader: string | undefined, name: string) => {
  for (const part of String(cookieHeader ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
};

export default async function adminBoundary(req: AdminRequest, res: ServerResponse) {
  const suppliedRequestId = req.headers['x-request-id'];
  const correlationId = typeof suppliedRequestId === 'string' && suppliedRequestId.length <= 128 ? suppliedRequestId : randomUUID();
  const method = String(req.method ?? 'GET').toUpperCase();

  console.info(JSON.stringify({ event: 'admin_boundary_request', correlationId, method }));

  if (method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return errorResponse(res, 405, 'method_not_allowed', correlationId);
  }

  const secret = sessionSecret();
  if (!secret) return errorResponse(res, 503, 'server_configuration_unavailable', correlationId);

  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  const session = verifyAdminSession(token, secret);
  if (!session) return errorResponse(res, 401, 'authentication_required', correlationId);

  const requestedCapabilityValue = req.query?.capability;
  const requestedCapability = Array.isArray(requestedCapabilityValue) ? requestedCapabilityValue[0] : requestedCapabilityValue ?? 'admin.read';
  if (!requestedCapability || !session.capabilities.has(requestedCapability)) {
    return errorResponse(res, 403, 'capability_denied', correlationId);
  }

  return json(res, 200, {
    ok: true,
    identity: { subject: session.subject },
    authorization: { capability: requestedCapability, decision: 'ALLOW' },
    correlationId,
  }, correlationId);
}

export const sessionCookieName = SESSION_COOKIE;
