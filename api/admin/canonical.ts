import { createHash } from 'node:crypto';

export const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
};

export const canonicalTimestamp = (value: string | null | undefined): string | null =>
  value == null ? null : new Date(value).toISOString();

export const integritySha256 = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');

export const assertIntegrityHash = (actual: unknown, expected: unknown, errorCode: string): void => {
  if (typeof actual !== 'string' || !/^[0-9a-f]{64}$/.test(actual) || actual !== integritySha256(expected)) {
    throw new Error(errorCode);
  }
};
