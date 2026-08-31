import type { Locale } from './config';

type Category = 'Images' | 'AI' | 'Other';

type TargetLocale = 'ms' | 'uk';

const CATEGORY_LABELS: Record<TargetLocale, Record<Category, string>> = {
  ms: { Images: 'Imej', AI: 'AI', Other: 'Lain-lain' },
  uk: { Images: 'Зображення', AI: 'ШІ', Other: 'Інше' },
};

const CATEGORY_DESCRIPTIONS: Record<TargetLocale, Record<Category, string>> = {
  ms: { Images: 'Imej', AI: 'AI', Other: 'Lain-lain' },
  uk: { Images: 'зображень', AI: 'ШІ', Other: 'інші' },
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
