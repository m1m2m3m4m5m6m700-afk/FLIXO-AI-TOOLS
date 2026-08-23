import { LOCALES, type Locale } from './config';
import { getTranslationBundle } from './loader';
export type { TranslationBundle } from './types';

/**
 * Compatibility facade. Runtime dictionaries are loaded through the lazy loader;
 * this module intentionally contains no static locale imports.
 */
export { getTranslationBundle };

export async function assertTranslationCoverage(): Promise<void> {
  await Promise.all(
    LOCALES.map(async (locale) => {
      const bundle = await getTranslationBundle(locale);
      if (!bundle.homeTitle || !bundle.homeDescription || !bundle.languageTag) {
        throw new Error(`Missing required translation bundle fields for locale: ${locale}`);
      }
    }),
  );
}
