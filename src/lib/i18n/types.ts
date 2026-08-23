import type { Locale } from './config';

export type TranslationBundle = Readonly<{
  locale: Locale;
  languageTag: string;
  direction: 'ltr' | 'rtl';
  siteName: string;
  homeTitle: string;
  homeDescription: string;
}>;
