import type { Locale } from './config';
import type { TranslationBundle } from './types';
import { SEED_UI_TRANSLATIONS } from './seed-ui-translations';

/** Lazy locale dictionary loaders. Each locale remains in its own file. */
const LOCALE_LOADERS: Record<Locale, () => Promise<TranslationBundle>> = {
  ar: async () => (await import('./locales/ar')).ar,
  en: async () => (await import('./locales/en')).en,
  es: async () => (await import('./locales/es')).es,
  fr: async () => (await import('./locales/fr')).fr,
  de: async () => (await import('./locales/de')).de,
  hi: async () => (await import('./locales/hi')).hi,
  id: async () => (await import('./locales/id')).id,
  it: async () => (await import('./locales/it')).it,
  ja: async () => (await import('./locales/ja')).ja,
  ko: async () => (await import('./locales/ko')).ko,
  ms: async () => (await import('./locales/ms')).ms,
  nl: async () => (await import('./locales/nl')).nl,
  pl: async () => (await import('./locales/pl')).pl,
  pt: async () => (await import('./locales/pt')).pt,
  ru: async () => (await import('./locales/ru')).ru,
  sv: async () => (await import('./locales/sv')).sv,
  th: async () => (await import('./locales/th')).th,
  tr: async () => (await import('./locales/tr')).tr,
  uk: async () => (await import('./locales/uk')).uk,
  vi: async () => (await import('./locales/vi')).vi,
};

const cache = new Map<Locale, Promise<TranslationBundle>>();

export function loadTranslationDictionary(locale: Locale): Promise<TranslationBundle> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const pending = LOCALE_LOADERS[locale]().then((bundle) => ({
    ...bundle,
    // Seed is a shared runtime surface; locale-specific source data still wins over the canonical fallback map.
    seedUi: { ...SEED_UI_TRANSLATIONS[locale], ...(bundle.seedUi ?? {}) },
  }));
  cache.set(locale, pending);
  return pending;
}

export async function getTranslationBundle(locale: Locale): Promise<TranslationBundle> {
  return loadTranslationDictionary(locale);
}

export async function preloadTranslationDictionaries(locales: readonly Locale[]): Promise<void> {
  await Promise.all(locales.map(loadTranslationDictionary));
}

export function clearTranslationDictionaryCache(): void {
  cache.clear();
}