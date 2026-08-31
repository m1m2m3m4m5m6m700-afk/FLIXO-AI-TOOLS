import type { Locale } from '../config';

export type Dictionary = Record<string, string | readonly string[]> & {
  locale: Locale;
  languageTag: string;
  direction: 'ltr' | 'rtl';
  siteName: string;
  homeTitle: string;
  homeDescription: string;
};

export const en: Dictionary = {
  locale: 'en' as Locale,
  languageTag: 'en',
  direction: 'ltr',
  siteName: 'FLIXO',
  homeTitle: 'Free online tools',
  homeDescription: 'Fast browser-based tools for images and everyday tasks.',
};
