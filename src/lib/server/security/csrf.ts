/** CSRF + server-side rate limiting helpers. */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAdminSessionSecret } from '../../admin/config';

const CSRF_COOKIE_NAME = 'flixo_csrf';
let fallbackKey: string | null = null;
function getCsrfKey(): string {
  try { return getAdminSessionSecret(); } catch {
    if (!fallbackKey) fallbackKey = randomBytes(32).toString('hex');
    return fallbackKey;
  }
}
function signToken(payload: string): string {
  return createHmac('sha256', getCsrfKey()).update(payload).digest('base64url');
}
export function buildCsrfToken(): { token: string; cookieHeader: string } {
  const payload = randomBytes(24).toString('hex');
  const token = `${payload}.${signToken(payload)}`;
  const cookieHeader = `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  return { token, cookieHeader };
}
export function readCsrfCookie(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === CSRF_COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return null;
}
export function verifyCsrf(cookieToken: string | null, headerToken: string | null): boolean {
  if (!cookieToken || !headerToken || cookieToken !== headerToken) return false;
  const dot = cookieToken.lastIndexOf('.');
  if (dot <= 0) return false;
  const a = Buffer.from(cookieToken.slice(dot + 1));
  const b = Buffer.from(signToken(cookieToken.slice(0, dot)));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function getCsrfCookieName(): string { return CSRF_COOKIE_NAME; }
interface RateLimiterOptions { capacity: number; refillPerSecond: number; }
interface Bucket { tokens: number; lastRefill: number; }
const buckets = new Map<string, Bucket>();
export function rateLimit(key: string, opts: RateLimiterOptions): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) { bucket = { tokens: opts.capacity, lastRefill: now }; buckets.set(key, bucket); }
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsed * opts.refillPerSecond);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) return { allowed: false, remaining: 0 };
  bucket.tokens -= 1;
  return { allowed: true, remaining: Math.floor(bucket.tokens) };
}
export const RATE_PRESETS = {
  login: { capacity: 10, refillPerSecond: 1 / 60 },
  contact: { capacity: 20, refillPerSecond: 1 / 10 },
  toolRequest: { capacity: 20, refillPerSecond: 1 / 10 },
} as const;
