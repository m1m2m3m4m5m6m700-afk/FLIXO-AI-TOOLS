import type { Locale } from '../config';
import type { SeedUiTranslations } from '../types';

export type Dictionary = {
  locale: Locale;
  languageTag: string;
  direction: 'ltr' | 'rtl';
  siteName: string;
  homeTitle: string;
  homeDescription: string;
  seedUi?: SeedUiTranslations;
};

export const en: Dictionary = {
  locale: 'en' as Locale,
  languageTag: 'en',
  direction: 'ltr',
  siteName: 'FLIXO',
  homeTitle: 'Free online tools',
  homeDescription: 'Fast browser-based tools for images and everyday tasks.',
};
