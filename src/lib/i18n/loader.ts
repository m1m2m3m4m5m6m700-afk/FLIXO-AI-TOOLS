import type { Locale } from './config';
import type { TranslationBundle } from './types';

/** Lazy locale dictionary loaders. Each locale remains in its own file. */
const LOCALE_LOADERS: Record<Locale, () => Promise<TranslationBundle>> = {
  en: async () => (await import('./locales/en')).en,
  ar: async () => (await import('./locales/ar')).ar,
  es: async () => (await import('./locales/es')).es,
  fr: async () => (await import('./locales/fr')).fr,
  de: async () => (await import('./locales/de')).de,
  ru: async () => (await import('./locales/ru')).ru,
  zh: async () => (await import('./locales/zh')).zh,
  hi: async () => (await import('./locales/hi')).hi,
  id: async () => (await import('./locales/id')).id,
  ur: async () => (await import('./locales/ur')).ur,
  ja: async () => (await import('./locales/ja')).ja,
  pt: async () => (await import('./locales/pt')).pt,
  it: async () => (await import('./locales/it')).it,
  ko: async () => (await import('./locales/ko')).ko,
  nl: async () => (await import('./locales/nl')).nl,
  pl: async () => (await import('./locales/pl')).pl,
  tr: async () => (await import('./locales/tr')).tr,
  vi: async () => (await import('./locales/vi')).vi,
  th: async () => (await import('./locales/th')).th,
  sv: async () => (await import('./locales/sv')).sv,
};

const cache = new Map<Locale, Promise<TranslationBundle>>();

export function loadTranslationDictionary(locale: Locale): Promise<TranslationBundle> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const pending = LOCALE_LOADERS[locale]();
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
