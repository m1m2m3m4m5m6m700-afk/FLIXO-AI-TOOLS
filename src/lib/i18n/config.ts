export const SITE_ORIGIN = 'https://flexoai.vercel.app';

export const LOCALES = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const X_DEFAULT_LOCALE: Locale = DEFAULT_LOCALE;

export const LOCALE_METADATA: Record<Locale, Readonly<{ languageTag: string; direction: 'ltr' | 'rtl' }>> = {
  en: { languageTag: 'en', direction: 'ltr' }, ar: { languageTag: 'ar', direction: 'rtl' }, es: { languageTag: 'es', direction: 'ltr' }, fr: { languageTag: 'fr', direction: 'ltr' }, de: { languageTag: 'de', direction: 'ltr' }, ru: { languageTag: 'ru', direction: 'ltr' }, zh: { languageTag: 'zh-CN', direction: 'ltr' }, hi: { languageTag: 'hi', direction: 'ltr' }, id: { languageTag: 'id', direction: 'ltr' }, ur: { languageTag: 'ur', direction: 'rtl' }, ja: { languageTag: 'ja', direction: 'ltr' }, pt: { languageTag: 'pt', direction: 'ltr' }, it: { languageTag: 'it', direction: 'ltr' }, ko: { languageTag: 'ko', direction: 'ltr' }, nl: { languageTag: 'nl', direction: 'ltr' }, pl: { languageTag: 'pl', direction: 'ltr' }, tr: { languageTag: 'tr', direction: 'ltr' }, vi: { languageTag: 'vi', direction: 'ltr' }, th: { languageTag: 'th', direction: 'ltr' }, sv: { languageTag: 'sv', direction: 'ltr' },
};

export function isLocale(value: string): value is Locale { return (LOCALES as readonly string[]).includes(value); }
export function normalizeLocale(value: string | null | undefined): Locale {
  const normalized = value?.toLowerCase().split('-')[0] ?? DEFAULT_LOCALE;
  return isLocale(normalized) ? normalized : DEFAULT_LOCALE;
}

export function getLocaleFromPathname(pathname: string): Locale {
  const segment = pathname.split('/').filter(Boolean)[0] ?? DEFAULT_LOCALE;
  return normalizeLocale(segment);
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const metadata = LOCALE_METADATA[locale];
  document.documentElement.lang = metadata.languageTag;
  document.documentElement.dir = metadata.direction;
}
