import type { CanonicalLocale } from './config';

export type TranslationBundle = Readonly<{
  locale: CanonicalLocale;
  languageTag: string;
  direction: 'ltr' | 'rtl';
  siteName: string;
  homeTitle: string;
  homeDescription: string;
}>;
