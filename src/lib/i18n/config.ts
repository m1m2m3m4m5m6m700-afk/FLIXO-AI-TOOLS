const DEFAULT_RUNTIME_ORIGIN = 'http://127.0.0.1:3000';
const configuredSiteOrigin =
  import.meta.env?.VITE_SITE_URL?.trim() || globalThis.process?.env?.VITE_SITE_URL?.trim();

// Vercel exposes the stable production domain on both preview and production
// deployments. It is not the per-deployment preview hostname and therefore can
// safely be used for canonical metadata when SITE_URL is not injected.
const vercelProductionOrigin = globalThis.process?.env?.VERCEL_PROJECT_PRODUCTION_URL?.trim();

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
 * Vercel's project-production URL is the one safe platform fallback because it
 * is stable across preview deployments; per-deployment Vercel URLs are always
 * rejected. CI and non-Vercel production builds should still provide SITE_URL.
 */
export function getCanonicalSiteOrigin(): string {
  const vercelFallback = normalizeVercelProductionOrigin(vercelProductionOrigin);
  const configured = configuredSiteOrigin || vercelFallback;

  if (!configured) {
    throw new Error(
      'VITE_SITE_URL is required for canonical SEO generation. Configure SITE_URL/VITE_SITE_URL with the real public production origin. Vercel deployments may use VERCEL_PROJECT_PRODUCTION_URL as the stable production-domain fallback.',
    );
  }

  const normalized = normalizeOrigin(configured);
  const origin = new URL(normalized);

  if (origin.protocol !== 'https:') {
    throw new Error('VITE_SITE_URL must use HTTPS.');
  }

  if (isBlockedDeploymentOrigin(origin)) {
    const allowedVercelFallback =
      vercelFallback !== undefined &&
      configured === vercelFallback &&
      origin.hostname === 'flixoai.vercel.app';

    if (!allowedVercelFallback) {
      throw new Error(
        `VITE_SITE_URL must be the real public production origin, not a preview/deployment origin: ${origin.origin}`,
      );
    }
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
