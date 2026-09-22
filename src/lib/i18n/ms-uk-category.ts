import type { Locale } from './config';
import type { ToolCategory } from '../../config/canonical-tool-definition.ts';

type TargetLocale = 'ms' | 'uk';

const CATEGORY_LABELS: Record<TargetLocale, Record<ToolCategory, string>> = {
  ms: { Images: 'Imej', Video: 'Video', Audio: 'Audio', AI: 'AI', Editor: 'Editor' },
  uk: { Images: 'Зображення', Video: 'Відео', Audio: 'Аудіо', AI: 'ШІ', Editor: 'Редактор' },
};

export function localizeMsUkCategory(locale: Locale, category: ToolCategory): string | undefined {
  if (locale !== 'ms' && locale !== 'uk') return undefined;
  return CATEGORY_LABELS[locale][category];
}

export function localizeMsUkDescription(locale: Locale, localizedTitle: string): string | undefined {
  if (locale === 'ms') return `Gunakan ${localizedTitle} FLIXO terus dalam pelayar anda.`;
  if (locale === 'uk') return `Використовуйте ${localizedTitle} FLIXO безпосередньо у браузері.`;
  return undefined;
}
