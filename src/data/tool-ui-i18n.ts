import type { Locale } from '@/lib/i18n';
import { normalizeLocale } from '@/lib/i18n';
import { TOOL_UI_FALLBACK } from './tool-ui-fallback';
import type { ToolUiCopy } from './tool-ui-locales/types';
import { getCachedToolUiCopy, loadToolUiCopy } from '@/lib/i18n/tool-ui-loader';

export type { ToolUiCopy } from './tool-ui-locales/types';
export { clearToolUiCopyCache, loadToolUiCopy } from '@/lib/i18n/tool-ui-loader';

/**
 * Synchronous compatibility accessor. The localized route preloads the active
 * locale before tool components render; any early caller safely receives the
 * small English fallback instead of pulling every locale into the bundle.
 */
export function getToolUiCopy(locale?: Locale): ToolUiCopy {
  const normalized = normalizeLocale(locale ?? (typeof document !== 'undefined' ? document.documentElement.lang : undefined));
  return getCachedToolUiCopy(normalized) ?? TOOL_UI_FALLBACK;
}
