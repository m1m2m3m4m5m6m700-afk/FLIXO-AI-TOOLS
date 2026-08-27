import {
  LOCALES,
  LOCALE_METADATA,
  SITE_ORIGIN,
  X_DEFAULT_LOCALE,
  type Locale,
} from '../i18n/config.ts';

export const SEO_DEFAULT_LOCALE: Locale = 'ar';

const SITE_URL = new URL(SITE_ORIGIN);

if (SITE_URL.protocol !== 'https:') {
  throw new Error('SEO site origin must use HTTPS.');
}

export type SeoPageInput = Readonly<{
  locale: Locale;
  path: string;
  title: string;
  description: string;
  type?: 'WebPage' | 'SoftwareApplication';
}>;

const normalizePath = (path: string): string => {
  if (typeof path !== 'string') {
    throw new TypeError('SEO path must be a string.');
  }

  if (path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new Error('SEO paths must be relative to the configured site origin.');
  }

  const value = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(value, SITE_URL);

  if (url.origin !== SITE_URL.origin) {
    throw new Error('SEO URL origin does not match SITE_ORIGIN.');
  }

  url.search = '';
  url.hash = '';
  url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');

  return url.pathname;
};

const localePrefixPattern = new RegExp(`^/(?:${LOCALES.join('|')})(?=/|$)`);

export const absoluteUrl = (path: string): string =>
  new URL(normalizePath(path), SITE_URL).toString();

export const localizedPath = (locale: Locale, path: string): string => {
  const normalized = normalizePath(path);
  const withoutLocale = normalized.replace(localePrefixPattern, '');
  return `/${locale}${withoutLocale || '/'}`.replace(/\/{2,}/g, '/');
};

export const buildHreflang = (path: string) => {
  const alternates = LOCALES.map((locale) => ({
    hreflang: LOCALE_METADATA[locale].languageTag,
    href: absoluteUrl(localizedPath(locale, path)),
  }));
  alternates.push({
    hreflang: 'x-default',
    href: absoluteUrl(localizedPath(X_DEFAULT_LOCALE, path)),
  });
  return alternates;
};

export const buildSeoMetadata = (input: SeoPageInput) => ({
  title: input.title,
  description: input.description,
  canonical: absoluteUrl(localizedPath(input.locale, input.path)),
  alternates: buildHreflang(input.path),
  language: LOCALE_METADATA[input.locale].languageTag,
  direction: LOCALE_METADATA[input.locale].direction,
  structuredData: {
    '@context': 'https://schema.org',
    '@type': input.type ?? 'WebPage',
    name: input.title,
    description: input.description,
    inLanguage: LOCALE_METADATA[input.locale].languageTag,
    url: absoluteUrl(localizedPath(input.locale, input.path)),
  },
});
