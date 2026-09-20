import type { ToolConfig } from '../../config/tool-definitions/types.ts';
import type { Locale } from '../i18n/config.ts';

export type CanonicalToolPathSource = Pick<ToolConfig, 'path'>;

const CANONICAL_TOOL_PATH = /^\/en(?:\/(.+))?\/?$/u;

function canonicalSlug(path: string): string {
  if (!path || !path.startsWith('/')) throw new Error(`Invalid canonical tool path: ${path}`);
  if (path.includes('?') || path.includes('#')) throw new Error(`Canonical tool path must not contain query/hash: ${path}`);

  const match = CANONICAL_TOOL_PATH.exec(path.replace(/\/+$/u, '') || '/');
  if (!match?.[1]) throw new Error(`Invalid canonical tool path: ${path}`);
  return match[1];
}

export function getLocalizedToolPath(tool: CanonicalToolPathSource, locale: Locale): string {
  return `/${locale}/${canonicalSlug(tool.path)}`;
}

export function getLocalizedToolUrl(
  origin: string,
  tool: CanonicalToolPathSource,
  locale: Locale,
): string {
  const base = origin.endsWith('/') ? origin : `${origin}/`;
  return new URL(getLocalizedToolPath(tool, locale).slice(1), base).toString();
}
