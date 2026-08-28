const DEFAULT_RUNTIME_ORIGIN = 'http://127.0.0.1:3000';
const configuredSiteOrigin =
  import.meta.env?.VITE_SITE_URL?.trim() ||
  globalThis.process?.env?.VITE_SITE_URL?.trim();

// Platform deployment metadata is useful for runtime discovery, but it is
// never authoritative for canonical SEO. The public domain must be supplied
// explicitly through SITE_URL/VITE_SITE_URL once it exists.
const vercelProductionOrigin =
  import.meta.env?.VITE_VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
  globalThis.process?.env?.VERCEL_PROJECT_PRODUCTION_URL?.trim();

function normalizeOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`VITE_SITE_URL must be an absolute URL: ${value}`);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('VITE_SITE_URL must not contain credentials, query parameters, or fragments.');
  }

  return parsed.origin.replace(/\/$/, '');
}

function normalizeVercelProductionOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function isBlockedDeploymentOrigin(origin: URL): boolean {
  return (
    origin.hostname === 'localhost' ||
    origin.hostname === '127.0.0.1' ||
    origin.hostname === 'vercel.app' ||
    origin.hostname.endsWith('.vercel.app') ||
    origin.hostname.endsWith('.vercel.sh')
  );
}

/**
 * Canonical SEO origin is deliberately independent from the deployment origin.
 * Vercel deployment URLs are never valid canonical origins, including the
 * platform project-production fallback while it still resolves to a
 * *.vercel.* hostname.
 */
export function getCanonicalSiteOrigin(): string {
  const vercelFallback = normalizeVercelProductionOrigin(vercelProductionOrigin);
  const configured = configuredSiteOrigin || vercelFallback;

  if (!configured) {
    throw new Error(
      'VITE_SITE_URL is required for canonical SEO generation. Configure SITE_URL/VITE_SITE_URL with the real public production origin.',
    );
  }

  const normalized = normalizeOrigin(configured);
  const origin = new URL(normalized);

  if (origin.protocol !== 'https:') {
    throw new Error('VITE_SITE_URL must use HTTPS.');
  }

  if (isBlockedDeploymentOrigin(origin)) {
    throw new Error(
      `VITE_SITE_URL must be the real public production origin, not a preview/deployment origin: ${origin.origin}`,
    );
  }

  return normalized;
}

// Runtime/browser target is intentionally separate from the canonical SEO
// origin. This allows Vercel deployments and local previews to remain fully
// testable without leaking their hostname into canonical/sitemap metadata.
export const SITE_ORIGIN = configuredSiteOrigin
  ? normalizeOrigin(configuredSiteOrigin)
  : typeof window !== 'undefined'
    ? window.location.origin
    : DEFAULT_RUNTIME_ORIGIN;

export const LOCALES = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const X_DEFAULT_LOCALE: Locale = DEFAULT_LOCALE;

export const LOCALE_METADATA: Record<Locale, Readonly<{ languageTag: string; direction: 'ltr' | 'rtl' }>> = {
  en: { languageTag: 'en', direction: 'ltr' },
  ar: { languageTag: 'ar', direction: 'rtl' },
  es: { languageTag: 'es', direction: 'ltr' },
  fr: { languageTag: 'fr', direction: 'ltr' },
  de: { languageTag: 'de', direction: 'ltr' },
  ru: { languageTag: 'ru', direction: 'ltr' },
  zh: { languageTag: 'zh-CN', direction: 'ltr' },
  hi: { languageTag: 'hi', direction: 'ltr' },
  id: { languageTag: 'id', direction: 'ltr' },
  ur: { languageTag: 'ur', direction: 'rtl' },
  ja: { languageTag: 'ja', direction: 'ltr' },
  pt: { languageTag: 'pt', direction: 'ltr' },
  it: { languageTag: 'it', direction: 'ltr' },
  ko: { languageTag: 'ko', direction: 'ltr' },
  nl: { languageTag: 'nl', direction: 'ltr' },
  pl: { languageTag: 'pl', direction: 'ltr' },
  tr: { languageTag: 'tr', direction: 'ltr' },
  vi: { languageTag: 'vi', direction: 'ltr' },
  th: { languageTag: 'th', direction: 'ltr' },
  sv: { languageTag: 'sv', direction: 'ltr' },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  const normalized = value?.toLowerCase().split('-')[0] ?? DEFAULT_LOCALE;
  return isLocale(normalized) ? normalized : DEFAULT_LOCALE;
}
