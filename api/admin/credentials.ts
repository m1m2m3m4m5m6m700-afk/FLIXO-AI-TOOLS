import { scryptSync, timingSafeEqual } from 'node:crypto';

type ParsedPasswordHash = {
  salt: Buffer;
  key: Buffer;
  N: number;
  r: number;
  p: number;
};

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const parts = value.split('$');
  if (parts.length !== 7 || parts[1] !== 'scrypt') return null;

  const N = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) return null;
  if (N <= 1 || r <= 0 || p <= 0) return null;

  try {
    const salt = Buffer.from(parts[5], 'base64');
    const key = Buffer.from(parts[6], 'base64');
    if (salt.length < 16 || key.length < 32) return null;
    return { salt, key, N, r, p };
  } catch {
    return null;
  }
}

/**
 * Verify the server-configured administrator credential.
 *
 * This helper is intentionally fail-closed: missing/malformed configuration
 * is indistinguishable from a wrong password to the caller.
 */
export function verifyAdminPassword(password: string): boolean {
  if (typeof password !== 'string' || password.length === 0 || password.length > 256) return false;

  const configured = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!configured) return false;

  const parsed = parsePasswordHash(configured);
  if (!parsed) return false;

  let derived: Buffer;
  try {
    derived = scryptSync(password, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: 128 * parsed.N * parsed.r + 1024 * 1024,
    });
  } catch {
    return false;
  }

  return derived.length === parsed.key.length && timingSafeEqual(derived, parsed.key);
}
