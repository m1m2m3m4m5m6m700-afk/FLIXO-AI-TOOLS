export {
  CANONICAL_LOCALES,
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_METADATA,
  SITE_ORIGIN,
  X_DEFAULT_LOCALE,
  getCanonicalSiteOrigin,
  isLocale,
  normalizeLocale,
} from './config';
export type { Locale, CanonicalLocale } from './config';
export {
  getTranslationBundle,
  loadTranslationDictionary,
  preloadTranslationDictionaries,
  clearTranslationDictionaryCache,
} from './loader';
export { assertTranslationCoverage } from './translations';
export type { TranslationBundle } from './types';
