import type { Locale } from '@/lib/i18n';
import type { HomeCopy } from '../../data/home-locales';
import { HOME_COPY_OVERRIDES } from './locale-quality-overrides';

const cache = new Map<Locale, Promise<HomeCopy>>();

export function loadHomeCopy(locale: Locale): Promise<HomeCopy> {
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
