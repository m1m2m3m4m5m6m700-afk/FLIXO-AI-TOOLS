import type { Locale } from '../lib/i18n/config';
import { buildLocalizedToolSeo } from '../lib/seo/tool-catalog';
import type { ToolConfig } from './tool-definitions/types';

/** Resolve canonical SEO names from the same locale generator used by the SEO manifest. */
export function getAuthoritativeToolSeoName(tool: ToolConfig, locale: Locale): string | undefined {
  return buildLocalizedToolSeo(tool, locale).title.replace(/\s+\|\s+FLIXO$/u, '');
}
