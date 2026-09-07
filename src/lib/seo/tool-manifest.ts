import type { KnownLocale, Locale } from '@/lib/i18n';

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

type BaseToolManifest = Readonly<{
  toolId: string;
  slug: string;
  status: 'ready';
  capabilities: readonly string[];
}>;

/** Pilot manifests may retain historical locale assets internally, but they are never public route locales. */
export type PilotToolManifest = BaseToolManifest & Readonly<{
  seoStatus: 'pilot';
  seoLocales: Readonly<Partial<Record<KnownLocale, LocalizedToolSeo>>>;
}>;

/** Complete manifests are production-ready and therefore require every canonical public locale. */
export type CompleteToolManifest = BaseToolManifest & Readonly<{
  seoStatus: 'complete';
  seoLocales: Readonly<Record<Locale, LocalizedToolSeo>>;
}>;

export type ToolManifest = PilotToolManifest | CompleteToolManifest;
