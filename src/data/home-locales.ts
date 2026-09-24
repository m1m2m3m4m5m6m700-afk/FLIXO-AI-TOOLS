import type { Locale } from '@/lib/i18n';
import { HOME_COPY_FALLBACK } from './home-locales/fallback';

export type { HomeCopy } from './home-locales/types';

export function getHomeCopy(_locale: Locale) {
  return HOME_COPY_FALLBACK;
}
