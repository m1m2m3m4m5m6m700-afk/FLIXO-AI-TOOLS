import type { Locale } from './config';
import type { ToolCategory } from '../../config/canonical-tool-definition.ts';

type SupportedCategory = Extract<ToolCategory, 'Images'>;
type TargetLocale = 'ms' | 'uk';

const CATEGORY_LABELS: Record<TargetLocale, Record<SupportedCategory, string>> = {
  ms: { Images: 'Imej' },
  uk: { Images: 'Зображення' },
};

export function localizeMsUkCategory(locale: Locale, category: ToolCategory): string | undefined {
  if (locale !== 'ms' && locale !== 'uk') return undefined;
  if (category !== 'Images') return undefined;
  return CATEGORY_LABELS[locale][category];
}

export function localizeMsUkDescription(locale: Locale, localizedTitle: string): string | undefined {
  if (locale === 'ms') return `Gunakan ${localizedTitle} FLIXO terus dalam pelayar anda.`;
  if (locale === 'uk') return `Використовуйте ${localizedTitle} FLIXO безпосередньо у браузері.`;
  return undefined;
}
