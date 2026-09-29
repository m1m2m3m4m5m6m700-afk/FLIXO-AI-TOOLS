import type { Locale } from '@/lib/i18n';

export type ToolSeoStatus = 'pilot' | 'complete';

export type LocalizedToolSeo = Readonly<{
  title: string;
  description: string;
  intro: string;
  keywords: readonly string[];
  howTo: readonly string[];
  features: readonly string[];
  altText: readonly string[];
}>;

export type ToolManifest = Readonly<{
  toolId: string;
  slug: string;
  status: 'ready';
  seoStatus: ToolSeoStatus;
  capabilities: readonly string[];
  seoLocales: Readonly<Record<string, LocalizedToolSeo>>;
}>;

export function assertCompleteToolSeoLocales(
  seoLocales: Readonly<Record<string, LocalizedToolSeo>>,
  locales: readonly Locale[],
  toolId: string,
): void {
  for (const locale of locales) {
    const entry = seoLocales[locale];
    if (!entry?.title || !entry.description || !entry.intro || !entry.howTo.length || !entry.features.length || !entry.altText.length) {
      throw new Error(`Incomplete SEO locale contract: ${toolId}:${locale}`);
    }
  }
}
