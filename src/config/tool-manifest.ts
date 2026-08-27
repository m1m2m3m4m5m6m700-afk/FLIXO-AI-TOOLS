import type { Locale } from '@/lib/i18n/config';
import { LOCALES } from '@/lib/i18n/config';
import { getToolSeoName } from '@/lib/i18n/tool-seo-localization';
import type { ToolConfig, ToolFamily } from './tool-definitions/types.ts';
import { AI_TOOLS, AUDIO_TOOLS, IMAGE_TOOLS, OTHER_TOOLS, PDF_TOOLS, VIDEO_TOOLS } from './registry.ts';

export type ToolManifestEntry = ToolConfig & {
  readonly family: ToolFamily;
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly robots: 'index,follow,max-image-preview:large';
  };
  readonly seoByLocale: Readonly<Record<Locale, { readonly title: string }>>;
};

function withFamily(family: ToolFamily, tools: readonly ToolConfig[]): readonly ToolManifestEntry[] {
  return tools.map((tool) => {
    const seoByLocale = Object.fromEntries(
      LOCALES.map((locale) => {
        const name = getToolSeoName(tool.id, locale);
        if (!name) throw new Error(`Missing reviewed SEO name: ${tool.id}:${locale}`);
        return [locale, { title: `${name} | FLIXO` }];
      }),
    ) as Record<Locale, { readonly title: string }>;

    return {
      ...tool,
      family,
      seo: {
        title: `${tool.title} | FLIXO`,
        description: tool.description,
        robots: 'index,follow,max-image-preview:large',
      },
      seoByLocale: Object.freeze(seoByLocale),
    };
  });
}

const TOOL_FAMILIES = [
  withFamily('image', IMAGE_TOOLS),
  withFamily('pdf', PDF_TOOLS),
  withFamily('audio', AUDIO_TOOLS),
  withFamily('video', VIDEO_TOOLS),
  withFamily('ai', AI_TOOLS),
  withFamily('other', OTHER_TOOLS),
] as const;

export const TOOL_MANIFEST: readonly ToolManifestEntry[] = Object.freeze(TOOL_FAMILIES.flat());

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

export function getToolsByFamily(family: ToolFamily): readonly ToolManifestEntry[] {
  return TOOL_MANIFEST.filter((tool) => tool.family === family);
}
