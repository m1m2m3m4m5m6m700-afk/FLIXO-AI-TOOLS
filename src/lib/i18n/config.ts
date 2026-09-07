import { getCanonicalSiteOrigin } from '../../config/origin.config.ts';
import { DEFAULT_LOCALE } from '../../config/locale.config.ts';

export { DEFAULT_LOCALE, getCanonicalSiteOrigin };

export const SITE_ORIGIN = getCanonicalSiteOrigin();

/** Runtime-supported public locale set. This is the sole public locale matrix. */
export const LOCALES = ['ar','en','es','fr','de','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi'] as const;
export type CanonicalLocale = (typeof LOCALES)[number];

/** Compatibility key type for legacy auxiliary maps. Runtime input is validated with isLocale. */
export type Locale = string;

export const LOCALE_METADATA: Record<string, Readonly<{ languageTag: string; direction: 'ltr' | 'rtl' }>> = {
  ar: { languageTag: 'ar', direction: 'rtl' },
  en: { languageTag: 'en', direction: 'ltr' },
  es: { languageTag: 'es', direction: 'ltr' },
  fr: { languageTag: 'fr', direction: 'ltr' },
  de: { languageTag: 'de', direction: 'ltr' },
  hi: { languageTag: 'hi', direction: 'ltr' },
  id: { languageTag: 'id', direction: 'ltr' },
  it: { languageTag: 'it', direction: 'ltr' },
  ja: { languageTag: 'ja', direction: 'ltr' },
  ko: { languageTag: 'ko', direction: 'ltr' },
  ms: { languageTag: 'ms', direction: 'ltr' },
  nl: { languageTag: 'nl', direction: 'ltr' },
  pl: { languageTag: 'pl', direction: 'ltr' },
  pt: { languageTag: 'pt', direction: 'ltr' },
  ru: { languageTag: 'ru', direction: 'ltr' },
  sv: { languageTag: 'sv', direction: 'ltr' },
  th: { languageTag: 'th', direction: 'ltr' },
  tr: { languageTag: 'tr', direction: 'ltr' },
  uk: { languageTag: 'uk', direction: 'ltr' },
  vi: { languageTag: 'vi', direction: 'ltr' },
};

export function isLocale(value: string): value is CanonicalLocale {
  return (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): CanonicalLocale {
  const normalized = value?.toLowerCase().split('-')[0] ?? DEFAULT_LOCALE;
  return isLocale(normalized) ? normalized : DEFAULT_LOCALE;
}
