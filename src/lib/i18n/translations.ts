import { ar } from './locales/ar';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { sv } from './locales/sv';
import { th } from './locales/th';
import { tr } from './locales/tr';
import { ur } from './locales/ur';
import { vi } from './locales/vi';
import { zh } from './locales/zh';
import { LOCALES, type Locale } from './config';

export type TranslationBundle = Readonly<{
  locale: Locale;
  languageTag: string;
  direction: 'ltr' | 'rtl';
  siteName: string;
  homeTitle: string;
  homeDescription: string;
}>;

export const TRANSLATION_BUNDLES: Record<Locale, TranslationBundle> = {
  en, ar, es, fr, de, ru, zh, hi, id, ur, ja, pt, it, ko, nl, pl, tr, vi, th, sv,
};

export function getTranslationBundle(locale: Locale): TranslationBundle {
  return TRANSLATION_BUNDLES[locale];
}

export function assertTranslationCoverage(): void {
  for (const locale of LOCALES) {
    const bundle = TRANSLATION_BUNDLES[locale];
    if (!bundle?.homeTitle || !bundle?.homeDescription || !bundle?.languageTag) {
      throw new Error(`Missing required translation bundle fields for locale: ${locale}`);
    }
  }
}
