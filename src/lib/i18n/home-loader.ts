import type { Locale } from '@/lib/i18n';
import type { HomeCopy } from '../../data/home-locales';

const cache = new Map<Locale, Promise<HomeCopy>>();

export function loadHomeCopy(locale: Locale): Promise<HomeCopy> {
  const cached = cache.get(locale);
  if (cached) return cached;

  const pending = import('../../data/home-locales').then(({ getHomeCopy }) => getHomeCopy(locale));
  cache.set(locale, pending);
  return pending;
}

export function clearHomeCopyCache(): void {
  cache.clear();
}
