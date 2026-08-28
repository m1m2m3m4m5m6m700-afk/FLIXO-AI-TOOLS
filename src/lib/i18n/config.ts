const DEFAULT_RUNTIME_ORIGIN = 'http://127.0.0.1:3000';
const configuredSiteOrigin =
  import.meta.env?.VITE_SITE_URL?.trim() || globalThis.process?.env?.VITE_SITE_URL?.trim();

// Vercel exposes the project's production domain to deployments. It is safe
// for canonical generation because it is the stable production domain rather
// than the per-deployment preview hostname. Preview URLs are never selected.
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

function isBlockedDeploymentOrigin(origin: URL): boolean {
  return (
    origin.hostname === 'localhost' ||
    origin.hostname === '127.0.0.1' ||
    origin.hostname === 'vercel.app' ||
    origin.hostname.endsWith('.vercel.sh')
  );
}

export function getCanonicalSiteOrigin(): string {
  const configured = configuredSiteOrigin || vercelProductionOrigin;

  if (!configured) {
    throw new Error(
      'VITE_SITE_URL is required for canonical SEO generation. Configure SITE_URL/VITE_SITE_URL for CI and non-Vercel production builds; Vercel deployments may use VERCEL_PROJECT_PRODUCTION_URL. Local test servers must use a separate runtime target such as LIGHTHOUSE_BASE_URL.',
    );
  }

  const normalized = normalizeOrigin(configured);
  const origin = new URL(normalized);

  if (origin.protocol !== 'https:') {
    throw new Error('VITE_SITE_URL must use HTTPS.');
  }

  // Never permit a deployment/preview hostname to become canonical. The only
  // Vercel hostname accepted here is the platform-provided project production
  // domain, and only when that exact value supplied the fallback.
  if (isBlockedDeploymentOrigin(origin)) {
    const isAllowedVercelProductionDomain =
      configured === vercelProductionOrigin &&
      origin.hostname === 'flixoai.vercel.app';

    if (!isAllowedVercelProductionDomain) {
      throw new Error(
        `VITE_SITE_URL must be the real public production origin, not a preview/deployment origin: ${origin.origin}`,
      );
    }
  }

  return normalized;
}

// Browser runtime may operate without a build-time canonical origin during
// local development. SEO/robots/sitemap/prerender generators must call
// getCanonicalSiteOrigin() instead.
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
