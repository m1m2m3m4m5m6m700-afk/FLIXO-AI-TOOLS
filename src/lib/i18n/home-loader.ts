import type { Locale } from '@/lib/i18n';
import { HOME_I18N, type HomeCopy } from '../../data/home-locales';
import { HOME_COPY_OVERRIDES } from './locale-quality-overrides';

const cache = new Map<Locale, HomeCopy>();

export function loadHomeCopy(locale: Locale): Promise<HomeCopy> {
  const cached = cache.get(locale);
  if (cached) return Promise.resolve(cached);

  const base = HOME_I18N[locale];
  const value: HomeCopy = {
    ...base,
    ...(HOME_COPY_OVERRIDES[locale] ?? {}),
  };
  cache.set(locale, value);
  return Promise.resolve(value);
}

export function clearHomeCopyCache(): void {
  cache.clear();
}
