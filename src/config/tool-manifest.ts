import type { Locale } from '../lib/i18n/config.ts';
import { LOCALES } from '../lib/i18n/config.ts';
import { getAuthoritativeToolSeoName } from './tool-seo-name-resolver.ts';
import type { ToolConfig } from './tool-definitions/types.ts';
import { IMAGE_TOOLS } from './registry.ts';

export type ToolManifestEntry = ToolConfig & {
  readonly family: 'image';
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly robots: 'index,follow,max-image-preview:large';
  };
  readonly seoByLocale: Readonly<Record<Locale, { readonly title: string }>>;
};

function withImageFamily(tools: readonly ToolConfig[]): readonly ToolManifestEntry[] {
  return tools.map((tool) => {
    const seoByLocale = Object.fromEntries(
      LOCALES.map((locale) => {
        const name = getAuthoritativeToolSeoName(tool, locale);
        if (!name) throw new Error(`Missing reviewed SEO name: ${tool.id}:${locale}`);
        return [locale, { title: `${name} | FLIXO` }];
      }),
    ) as Record<Locale, { readonly title: string }>;

    return {
      ...tool,
      family: 'image' as const,
      seo: {
        title: `${tool.title} | FLIXO`,
        description: tool.description,
        robots: 'index,follow,max-image-preview:large',
      },
      seoByLocale: Object.freeze(seoByLocale),
    };
  });
}

export const TOOL_MANIFEST: readonly ToolManifestEntry[] = Object.freeze(withImageFamily(IMAGE_TOOLS).filter((tool) => tool.category === 'Images'));

const byId = new Map(TOOL_MANIFEST.map((tool) => [tool.id, tool]));
const byPath = new Map<string, ToolManifestEntry>();
for (const tool of TOOL_MANIFEST) {
  byPath.set(tool.path, tool);
  for (const alias of tool.aliases ?? []) byPath.set(alias, tool);
}

export function getToolManifest(id: string): ToolManifestEntry | undefined {
  return byId.get(id);
}

export function getToolManifestByPath(path: string): ToolManifestEntry | undefined {
  return byPath.get(path);
}

export function getToolsByFamily(family: 'image'): readonly ToolManifestEntry[] {
  return family === 'image' ? TOOL_MANIFEST : [];
}
