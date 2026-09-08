import type { Locale } from '../lib/i18n/config';
import { localizeToolTitle } from '../lib/i18n/tool-localization';
import { getAuthoritativeToolSeoName } from './tool-seo-name-resolver';
import type { ToolConfig } from './tool-definitions/types';

/** Canonical visible UI title. Prefer the authoritative localized tool name used by SEO. */
export function getToolUiTitle(tool: ToolConfig, locale: Locale): string {
  return getAuthoritativeToolSeoName(tool, locale) ?? localizeToolTitle(locale, tool.title, tool.category);
}
