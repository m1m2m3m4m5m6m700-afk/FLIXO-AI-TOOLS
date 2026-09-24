import type { Locale } from '@/lib/i18n';
import type { HomeCopy } from '../../data/home-locales/types';
import { HOME_COPY_OVERRIDES } from './locale-quality-overrides';

const LOADERS: Record<Locale, () => Promise<HomeCopy>> = {
  ar: async () => (await import('../../data/home-locales/ar')).homeCopy,
  en: async () => (await import('../../data/home-locales/en')).homeCopy,
  es: async () => (await import('../../data/home-locales/es')).homeCopy,
  fr: async () => (await import('../../data/home-locales/fr')).homeCopy,
  de: async () => (await import('../../data/home-locales/de')).homeCopy,
  hi: async () => (await import('../../data/home-locales/hi')).homeCopy,
  id: async () => (await import('../../data/home-locales/id')).homeCopy,
  it: async () => (await import('../../data/home-locales/it')).homeCopy,
  ja: async () => (await import('../../data/home-locales/ja')).homeCopy,
  ko: async () => (await import('../../data/home-locales/ko')).homeCopy,
  ms: async () => (await import('../../data/home-locales/ms')).homeCopy,
  nl: async () => (await import('../../data/home-locales/nl')).homeCopy,
  pl: async () => (await import('../../data/home-locales/pl')).homeCopy,
  pt: async () => (await import('../../data/home-locales/pt')).homeCopy,
  ru: async () => (await import('../../data/home-locales/ru')).homeCopy,
  sv: async () => (await import('../../data/home-locales/sv')).homeCopy,
  th: async () => (await import('../../data/home-locales/th')).homeCopy,
  tr: async () => (await import('../../data/home-locales/tr')).homeCopy,
  uk: async () => (await import('../../data/home-locales/uk')).homeCopy,
  vi: async () => (await import('../../data/home-locales/vi')).homeCopy,
};

const cache = new Map<Locale, Promise<HomeCopy>>();

export function loadHomeCopy(locale: Locale): Promise<HomeCopy> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const pending = LOADERS[locale]().then((copy) => ({
    ...copy,
    ...(HOME_COPY_OVERRIDES[locale] ?? {}),
  }));
  cache.set(locale, pending);
  return pending;
}

export function clearHomeCopyCache(): void {
  cache.clear();
}
