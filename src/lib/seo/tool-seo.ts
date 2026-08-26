import { getReadyToolConfigs, getToolConfig, type ToolConfig } from '../../config/tools';
import { LOCALES, LOCALE_METADATA, SITE_ORIGIN, type Locale, normalizeLocale } from '../i18n';
import { getToolSeoManifest } from './tool-manifests';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'Online tool', ar: 'أداة عبر الإنترنت', es: 'Herramienta en línea', fr: 'Outil en ligne',
  de: 'Online-Tool', ru: 'Онлайн-инструмент', zh: '在线工具', hi: 'ऑनलाइन टूल', id: 'Alat online',
  ur: 'آن لائن ٹول', ja: 'オンラインツール', pt: 'Ferramenta online', it: 'Strumento online',
  ko: '온라인 도구', nl: 'Online tool', pl: 'Narzędzie online', tr: 'Çevrimiçi araç',
  vi: 'Công cụ trực tuyến', th: 'เครื่องมือออนไลน์', sv: 'Onlineverktyg',
};

export const READY_TOOL_IDS = Object.freeze(getReadyToolConfigs().map((tool) => tool.id));

export function getLocalizedToolUrl(locale: Locale, toolId: string): string {
  return `${SITE_ORIGIN}/${locale}/${toolId}`;
}

export function getToolSeo(localeInput: string, toolId: string) {
  const locale = normalizeLocale(localeInput);
  const tool = getToolConfig(toolId);

  if (!tool || !tool.isReady) return null;

  const label = LOCALE_LABELS[locale];
  const url = getLocalizedToolUrl(locale, tool.id);
  const xDefaultUrl = getLocalizedToolUrl('en', tool.id);
  const manifest = getToolSeoManifest(tool.id);
  const manifestSeo = manifest?.seoLocales[locale];
  const title = manifestSeo?.title ?? `${tool.title} | FLIXO`;
  const description = manifestSeo?.description ?? `${label} FLIXO: ${tool.description}`;
  const localizedPayload = manifestSeo ?? {
    title,
    description,
    intro: description,
    keywords: [title, 'FLIXO', label],
    howTo: ['Open the tool.', 'Configure the available options.', 'Run the tool.', 'Download the result.'],
    features: ['Browser-first processing'],
    altText: [`${title} interface`],
  };

  return {
    locale,
    tool,
    url,
    xDefaultUrl,
    title,
    description,
    intro: localizedPayload.intro,
    keywords: localizedPayload.keywords,
    howTo: localizedPayload.howTo,
    features: localizedPayload.features,
    altText: localizedPayload.altText,
    languageTag: LOCALE_METADATA[locale].languageTag,
    direction: LOCALE_METADATA[locale].direction,
    alternates: LOCALES.map((alternateLocale) => ({
      locale: alternateLocale,
      languageTag: LOCALE_METADATA[alternateLocale].languageTag,
      url: getLocalizedToolUrl(alternateLocale, tool.id),
    })),
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: title,
          description,
          url,
          inLanguage: LOCALE_METADATA[locale].languageTag,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Any',
          keywords: localizedPayload.keywords.join(', '),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'FLIXO',
              item: `${SITE_ORIGIN}/${locale}`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: tool.category,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: title,
              item: getLocalizedToolUrl(locale, tool.id),
            },
          ],
        },
      ],
    },
  } as const;
}

export function getReadyToolsForSeo(): readonly ToolConfig[] {
  return getReadyToolConfigs();
}
