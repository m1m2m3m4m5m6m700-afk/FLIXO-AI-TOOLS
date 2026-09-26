import { CANONICAL_LOCALES, type CanonicalLocale } from '../i18n/config.ts';

export interface ToolRoute {
  path: string;
}

export type CanonicalToolPathSource = ToolRoute;

const LOCALE_PREFIX = new RegExp(
  `^/(?:${CANONICAL_LOCALES.join('|')})(?=/|$)`,
  'u',
);

function canonicalSlug(path: string): string {
  if (!path || !path.startsWith('/')) {
    throw new Error(`Invalid canonical tool path: ${path}`);
  }
  if (path.includes('?') || path.includes('#')) {
    throw new Error('Canonical tool path cannot contain query/hash');
  }

  const slug = path
    .replace(LOCALE_PREFIX, '')
    .replace(/^\/+|\/+$/gu, '');

  if (!slug) {
    throw new Error(`Invalid canonical tool path: ${path}`);
  }

  return slug;
}

export function getLocalizedToolPath(
  tool: ToolRoute,
  locale: CanonicalLocale,
): string {
  return `/${locale}/${canonicalSlug(tool.path)}`;
}

export function getLocalizedToolUrl(
  baseUrl: string,
  tool: ToolRoute,
  locale: CanonicalLocale,
): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return new URL(
    getLocalizedToolPath(tool, locale).slice(1),
    `${normalizedBase}/`,
  ).toString();
}
