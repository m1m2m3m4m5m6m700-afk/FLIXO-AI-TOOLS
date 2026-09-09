import type { Locale } from '../lib/i18n/config';
import { TOOL_SEO_NAMES } from '../lib/i18n/tool-seo-localization';
import { PIX_MANIFEST } from '../tools/pix/manifest';
import type { ToolDefinition } from './canonical-tool-definition';

/** Resolve canonical localized SEO names from each tool's authoritative manifest. */
export function getAuthoritativeToolSeoName(tool: ToolDefinition, locale: Locale): string | undefined {
  if (tool.id === 'pix') return PIX_MANIFEST.seoLocales[locale]?.title;
  if (tool.id === 'image-compressor' && locale === 'ar') return 'ضغط الصور أونلاين';
  return TOOL_SEO_NAMES[tool.id]?.[locale];
}
