import type { Locale } from '../i18n/config.ts';

const CANONICAL_LOCALE_PREFIX = '/en';

/**
 * Convert a canonical ToolManifest path (which is always /en/...) into the
 * localized route used by all public locale variants.
 */
export function getLocalizedToolPath(tool: { readonly path: string }, locale: Locale): string {
  if (!tool.path.startsWith(`${CANONICAL_LOCALE_PREFIX}/`)) {
    throw new Error(`Invalid canonical tool path: ${tool.path}`);
  }

  const suffix = tool.path.slice(CANONICAL_LOCALE_PREFIX.length);
  return `/${locale}${suffix}`;
}

export function getLocalizedToolUrl(
  siteOrigin: string,
  tool: { readonly path: string },
  locale: Locale,
): string {
  return new URL(getLocalizedToolPath(tool, locale), `${siteOrigin}/`).toString();
}
