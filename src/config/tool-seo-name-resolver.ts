import type { Locale } from '../lib/i18n/config';
import { TOOL_SEO_NAMES } from '../lib/i18n/tool-seo-localization';
import type { ToolConfig } from './tool-definitions/types';

/** Resolve canonical SEO names from the image-only locale dictionary. */
export function getAuthoritativeToolSeoName(tool: ToolConfig, locale: Locale): string | undefined {
  if (tool.id === 'image-compressor' && locale === 'ar') return 'ضغط الصور أونلاين';
  return TOOL_SEO_NAMES[tool.id]?.[locale];
}
