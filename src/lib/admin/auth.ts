import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { timingSafeEqual, scryptSync } from 'node:crypto';
import { getAdminSession } from './session';
import { rateLimit, RATE_PRESETS } from '../server/security/csrf';
import { securityRequestMiddleware } from '../security/requestMiddleware';

const loginSchema = z.object({ password: z.string().min(1).max(256) });

type PasswordHash = {
  salt: Buffer;
  key: Buffer;
  N: number;
  r: number;
  p: number;
};

function parsePasswordHash(value: string): PasswordHash | null {
  const parts = value.split('$');
  if (parts.length !== 7 || parts[1] !== 'scrypt') return null;
  const N = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) return null;
  try {
    return { N, r, p, salt: Buffer.from(parts[5], 'base64'), key: Buffer.from(parts[6], 'base64') };
  } catch {
    return null;
  }
}

function verifyAdminPassword(password: string): boolean {
  const configured = process.env.ADMIN_PASSWORD_HASH;
  if (!configured) return false;
  const parsed = parsePasswordHash(configured);
  if (!parsed || parsed.salt.length < 16 || parsed.key.length < 32) return false;
  const derived = scryptSync(password, parsed.salt, parsed.key.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: 128 * parsed.N * parsed.r + 1024 * 1024,
  });
  return derived.length === parsed.key.length && timingSafeEqual(derived, parsed.key);
}

export const getAdminSessionStatus = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const session = await getAdminSession();
    return { authenticated: Boolean(session.data.userId), role: session.data.role ?? null };
  } catch {
    return { authenticated: false, role: null };
  }
});

export const loginAdmin = createServerFn({ method: 'POST' })
  .validator(loginSchema)
  .middleware([securityRequestMiddleware])
  .handler(async ({ context, data }) => {
    const rl = rateLimit(`admin-login:${context.clientIp ?? 'unknown'}`, RATE_PRESETS.login);
    if (!rl.allowed) {
      return { ok: false as const, error: 'Too many login attempts. Please try again later.' };
    }

    if (!verifyAdminPassword(data.password)) {
      return { ok: false as const, error: 'Invalid administrator credentials.' };
    }

    const session = await getAdminSession();
    await session.update({ userId: 'owner', role: 'owner' });
    return { ok: true as const, role: 'owner' as const };
  });

export const logoutAdmin = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});
