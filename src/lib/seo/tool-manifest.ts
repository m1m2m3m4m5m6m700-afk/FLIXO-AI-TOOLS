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
  seoLocales: Readonly<Record<Locale, LocalizedToolSeo>>;
}>;
