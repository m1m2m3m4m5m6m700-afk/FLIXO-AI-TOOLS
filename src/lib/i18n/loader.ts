import { DEFAULT_LOCALE, normalizeLocale } from './config';
import type { Locale } from './config';
import type { TranslationBundle } from './types';

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

const cache = new Map<ReturnType<typeof normalizeLocale>, Promise<TranslationBundle>>();

export function loadTranslationDictionary(locale: Locale): Promise<TranslationBundle> {
  const canonicalLocale = normalizeLocale(locale);
  const cached = cache.get(canonicalLocale);
  if (cached) return cached;
  const loader = LOCALE_LOADERS[canonicalLocale];
  const pending = loader?.();
  if (!pending) {
    // The canonical locale map is intentionally total; this guard keeps the runtime fail-closed if that invariant is ever broken.
    return LOCALE_LOADERS[DEFAULT_LOCALE]();
  }
  cache.set(canonicalLocale, pending);
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
