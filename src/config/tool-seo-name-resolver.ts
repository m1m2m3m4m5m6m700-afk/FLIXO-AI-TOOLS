import type { Locale } from '../lib/i18n/config';
import { localizeMsUkToolTitle } from '../lib/i18n/ms-uk-tool-title';
import { ms } from '../lib/i18n/locales/ms';
import { uk } from '../lib/i18n/locales/uk';
import { TOOL_SEO_NAMES } from '../lib/i18n/tool-seo-localization';
import type { ToolConfig } from './tool-definitions/types';

const HISTORICAL_DICTIONARIES: Partial<Record<Locale, Record<string, unknown>>> = {
  ms: ms as Record<string, unknown>,
  uk: uk as Record<string, unknown>,
};

/** Reviewed additions that were introduced after the historical locale dictionaries. */
const REVIEWED_TOOL_SEO_OVERRIDES: Partial<Record<Locale, Record<string, string>>> = {
  ms: {
    'image-upscaler': 'Peningkat Resolusi Imej',
    'image-converter': 'Penukar Imej',
  },
  uk: {
    'image-upscaler': 'Збільшувач зображень',
    'image-converter': 'Конвертер зображень',
  },
};

/** Resolve reviewed SEO names without allowing an English fallback to masquerade as localization. */
export function getAuthoritativeToolSeoName(tool: ToolConfig, locale: Locale): string | undefined {
  const legacy = TOOL_SEO_NAMES[tool.id]?.[locale];
  if (typeof legacy === 'string' && legacy.trim()) return legacy;

  const dictionary = HISTORICAL_DICTIONARIES[locale];
  const translated = dictionary?.[`tool.${tool.id}.name`];
  if (typeof translated === 'string' && translated.trim()) return translated;

  const reviewed = REVIEWED_TOOL_SEO_OVERRIDES[locale]?.[tool.id];
  if (typeof reviewed === 'string' && reviewed.trim()) return reviewed;

  return localizeMsUkToolTitle(locale, tool.title, tool.category);
}
