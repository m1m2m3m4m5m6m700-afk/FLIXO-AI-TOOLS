import type { Locale } from './config';
import { isLocale } from './config';
import type { HomeCopy } from '../../data/home-locales';
import { HOME_COPY_OVERRIDES } from './locale-quality-overrides';

const cache = new Map<Locale, Promise<HomeCopy>>();

export function loadHomeCopy(locale: Locale): Promise<HomeCopy> {
  if (!isLocale(locale)) {
    return Promise.reject(new Error(`Unsupported Home locale: ${locale}`));
  }

  const cached = cache.get(locale);
  if (cached) return cached;

  const pending = import('../../data/home-locales').then(({ getHomeCopy }) => ({
    ...getHomeCopy(locale),
    ...(HOME_COPY_OVERRIDES[locale] ?? {}),
  }));
  cache.set(locale, pending);
  return pending;
}

export function clearHomeCopyCache(): void {
  cache.clear();
}
