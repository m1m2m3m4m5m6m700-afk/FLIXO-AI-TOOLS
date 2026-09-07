import type { CanonicalLocale, LegacyLocale, Locale } from '@/lib/i18n';

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

type CanonicalSeoLocales = Readonly<Record<CanonicalLocale, LocalizedToolSeo>>;
type LegacySeoLocales = Readonly<Record<Exclude<Locale, 'ms' | 'uk'>, LocalizedToolSeo>>;

/**
 * Tool manifests still contain the pre-migration zh/ur SEO dataset on some tools.
 * Canonical 20-locale SEO completeness is enforced by the authoritative tool-seo validator;
 * the manifest type explicitly models the two accepted dataset generations without widening to string.
 */
export type ToolManifest = Readonly<{
  toolId: string;
  slug: string;
  status: 'ready';
  seoStatus: ToolSeoStatus;
  capabilities: readonly string[];
  seoLocales: CanonicalSeoLocales | LegacySeoLocales;
}>;
