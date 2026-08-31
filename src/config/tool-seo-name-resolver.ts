import type { Locale } from '../lib/i18n/config';
import { localizeMsUkToolTitle } from '../lib/i18n/ms-uk-tool-title';
import { TOOL_SEO_NAMES } from '../lib/i18n/tool-seo-localization';
import type { ToolConfig } from './tool-definitions/types';

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

/** Resolve reviewed SEO names without statically importing locale dictionaries. */
export function getAuthoritativeToolSeoName(tool: ToolConfig, locale: Locale): string | undefined {
  const legacy = TOOL_SEO_NAMES[tool.id]?.[locale];
  if (typeof legacy === 'string' && legacy.trim()) return legacy;

  const reviewed = REVIEWED_TOOL_SEO_OVERRIDES[locale]?.[tool.id];
  if (typeof reviewed === 'string' && reviewed.trim()) return reviewed;

  return localizeMsUkToolTitle(locale, tool.title, tool.category);
}
