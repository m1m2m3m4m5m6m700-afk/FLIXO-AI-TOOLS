import type { Locale } from './config';

type Category = 'Images';
type TargetLocale = 'ms' | 'uk';

const CATEGORY_LABELS: Record<TargetLocale, Record<Category, string>> = {
  ms: { Images: 'Imej' },
  uk: { Images: 'Зображення' },
};

export function localizeMsUkCategory(locale: Locale, category: Category): string | undefined {
  if (locale !== 'ms' && locale !== 'uk') return undefined;
  return CATEGORY_LABELS[locale][category];
}

export function localizeMsUkDescription(locale: Locale, localizedTitle: string): string | undefined {
  if (locale === 'ms') return `Gunakan ${localizedTitle} FLIXO terus dalam pelayar anda.`;
  if (locale === 'uk') return `Використовуйте ${localizedTitle} FLIXO безпосередньо у браузері.`;
  return undefined;
}
