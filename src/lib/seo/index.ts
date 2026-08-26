import {
  LOCALES,
  LOCALE_METADATA,
  SITE_ORIGIN,
  X_DEFAULT_LOCALE,
  type Locale,
} from '@/lib/i18n';

export type SeoPageInput = Readonly<{
  locale: Locale;
  path: string;
  title: string;
  description: string;
  type?: 'WebPage' | 'SoftwareApplication';
}>;

const normalizePath = (path: string) => {
  const value = path.startsWith('/') ? path : `/${path}`;
  return value === '/' ? '/' : value.replace(/\/+$/, '');
};

const localePrefixPattern = new RegExp(`^/(?:${LOCALES.join('|')})(?=/|$)`);

export const absoluteUrl = (path: string): string =>
  new URL(normalizePath(path), SITE_ORIGIN).toString();

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
  alternates.push({ hreflang: 'x-default', href: absoluteUrl(localizedPath(X_DEFAULT_LOCALE, path)) });
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
