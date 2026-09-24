import type { Locale } from './config';
import type { ToolUiCopy } from '@/data/tool-ui-locales/types';

const LOADERS: Record<Locale, () => Promise<ToolUiCopy>> = {
  en: async () => (await import('@/data/tool-ui-locales/en')).toolUi,
  ar: async () => (await import('@/data/tool-ui-locales/ar')).toolUi,
  es: async () => (await import('@/data/tool-ui-locales/es')).toolUi,
  fr: async () => (await import('@/data/tool-ui-locales/fr')).toolUi,
  de: async () => (await import('@/data/tool-ui-locales/de')).toolUi,
  ru: async () => (await import('@/data/tool-ui-locales/ru')).toolUi,
  hi: async () => (await import('@/data/tool-ui-locales/hi')).toolUi,
  id: async () => (await import('@/data/tool-ui-locales/id')).toolUi,
  ja: async () => (await import('@/data/tool-ui-locales/ja')).toolUi,
  ko: async () => (await import('@/data/tool-ui-locales/ko')).toolUi,
  ms: async () => (await import('@/data/tool-ui-locales/ms')).toolUi,
  nl: async () => (await import('@/data/tool-ui-locales/nl')).toolUi,
  pl: async () => (await import('@/data/tool-ui-locales/pl')).toolUi,
  pt: async () => (await import('@/data/tool-ui-locales/pt')).toolUi,
  it: async () => (await import('@/data/tool-ui-locales/it')).toolUi,
  tr: async () => (await import('@/data/tool-ui-locales/tr')).toolUi,
  uk: async () => (await import('@/data/tool-ui-locales/uk')).toolUi,
  vi: async () => (await import('@/data/tool-ui-locales/vi')).toolUi,
  th: async () => (await import('@/data/tool-ui-locales/th')).toolUi,
  sv: async () => (await import('@/data/tool-ui-locales/sv')).toolUi,
};

const cache = new Map<Locale, Promise<ToolUiCopy>>();
const resolvedCache = new Map<Locale, ToolUiCopy>();

export function loadToolUiCopy(locale: Locale): Promise<ToolUiCopy> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const pending = LOADERS[locale]().then((copy) => {
    resolvedCache.set(locale, copy);
    return copy;
  });
  cache.set(locale, pending);
  return pending;
}

export function getCachedToolUiCopy(locale: Locale): ToolUiCopy | undefined {
  return resolvedCache.get(locale);
}

export function clearToolUiCopyCache(): void {
  cache.clear();
  resolvedCache.clear();
}
