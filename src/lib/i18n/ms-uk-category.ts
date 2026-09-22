import type { Locale } from './config';
import type { ToolCategory } from '../../config/canonical-tool-definition.ts';
import { localizeToolCategory } from './tool-localization.ts';

export function localizeMsUkCategory(locale: Locale, category: ToolCategory): string | undefined {
  if (locale !== 'ms' && locale !== 'uk') return undefined;
  return localizeToolCategory(locale, category);
}

export function localizeMsUkDescription(locale: Locale, localizedTitle: string): string | undefined {
  if (locale === 'ms') return `Gunakan ${localizedTitle} FLIXO terus dalam pelayar anda.`;
  if (locale === 'uk') return `Використовуйте ${localizedTitle} FLIXO безпосередньо у браузері.`;
  return undefined;
}
