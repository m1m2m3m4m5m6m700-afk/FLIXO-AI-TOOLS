import type { Locale } from '../lib/i18n/config';
import { localizeToolTitle } from '../lib/i18n/tool-localization';
import type { ToolConfig } from './tool-definitions/types';

/** Canonical visible UI title. This contract is intentionally separate from SEO naming. */
export function getToolUiTitle(tool: ToolConfig, locale: Locale): string {
  if (tool.id === 'image-compressor' && locale === 'ar') return 'ضغط الصور أونلاين';
  return localizeToolTitle(locale, tool.title, tool.category);
}
