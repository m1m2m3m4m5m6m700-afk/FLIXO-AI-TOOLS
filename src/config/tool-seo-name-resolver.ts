import type { Locale } from '../lib/i18n/config';
import { ms } from '../lib/i18n/locales/ms';
import { uk } from '../lib/i18n/locales/uk';
import { TOOL_SEO_NAMES } from '../lib/i18n/tool-seo-localization';
import type { ToolConfig } from './tool-definitions/types';

const HISTORICAL_DICTIONARIES: Partial<Record<Locale, Record<string, unknown>>> = {
  ms: ms as Record<string, unknown>,
  uk: uk as Record<string, unknown>,
};

/** Reviewed additions not yet present in the historical dictionaries. */
const REVIEWED_TOOL_SEO_OVERRIDES: Partial<Record<Locale, Record<string, string>>> = {
  ms: {
    'image-upscaler': 'Peningkat Resolusi Imej',
  },
  uk: {
    'image-upscaler': 'Збільшувач зображень',
  },
};

/** Resolve reviewed SEO names from the canonical catalog, verified locale dictionaries, then reviewed additions. */
export function getAuthoritativeToolSeoName(tool: ToolConfig, locale: Locale): string | undefined {
  const legacy = TOOL_SEO_NAMES[tool.id]?.[locale];
  if (typeof legacy === 'string' && legacy.trim()) return legacy;

  const dictionary = HISTORICAL_DICTIONARIES[locale];
  const translated = dictionary?.[`tool.${tool.id}.name`];
  if (typeof translated === 'string' && translated.trim()) return translated;

  const reviewed = REVIEWED_TOOL_SEO_OVERRIDES[locale]?.[tool.id];
  return typeof reviewed === 'string' && reviewed.trim() ? reviewed : undefined;
}
