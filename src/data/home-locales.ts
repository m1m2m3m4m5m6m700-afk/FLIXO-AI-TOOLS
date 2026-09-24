import type { Locale } from '@/lib/i18n';
import type { HomeCopy } from './home-locales/types';
import { HOME_COPY_FALLBACK } from './home-locales/fallback';

export type { HomeCopy } from './home-locales/types';

export const HOME_COPY_FALLBACK_BY_LOCALE: Partial<Record<Locale, HomeCopy>> = {
  en: HOME_COPY_FALLBACK,
};

export function getHomeCopyFallback(_locale: Locale): HomeCopy {
  return HOME_COPY_FALLBACK;
}
