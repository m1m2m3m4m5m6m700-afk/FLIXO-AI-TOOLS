import type { Locale } from '../lib/i18n/config';
import { localizeToolTitle } from '../lib/i18n/tool-localization';
import { getAuthoritativeToolSeoName } from './tool-seo-name-resolver';
import type { ToolDefinition } from './canonical-tool-definition';

/** Canonical visible UI title. Prefer the authoritative localized tool name used by SEO. */
export function getToolUiTitle(tool: ToolDefinition, locale: Locale): string {
  if (tool.id === 'image-compressor' && locale === 'ar') return 'ضغط الصور أونلاين';
  return getAuthoritativeToolSeoName(tool, locale) ?? localizeToolTitle(locale, tool.title, tool.category);
}
