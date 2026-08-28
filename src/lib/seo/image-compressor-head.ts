import { LOCALES, LOCALE_METADATA, SITE_ORIGIN, type Locale } from '../i18n/config.ts';

const COPY: Record<'en' | 'ar', Readonly<{ name: string; description: string }>> = {
  en: {
    name: 'Image Compressor',
    description: 'Use Image Compressor directly in your browser with a fast workflow focused on privacy and simple exports.',
  },
  ar: {
    name: 'ضاغط الصور',
    description: 'استخدم ضاغط الصور مباشرة داخل المتصفح مع تجربة سريعة تركز على الخصوصية وسهولة استخراج النتائج.',
  },
};

export function getImageCompressorHeadSeo(locale: 'en' | 'ar') {
  const { name, description } = COPY[locale];
  const url = `${SITE_ORIGIN}/${locale}/image-compressor`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    inLanguage: LOCALE_METADATA[locale].languageTag,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
  } as const;

  return {
    locale,
    title: `${name} | FLIXO`,
    description,
    url,
    xDefaultUrl: `${SITE_ORIGIN}/en/image-compressor`,
    languageTag: LOCALE_METADATA[locale].languageTag,
    direction: LOCALE_METADATA[locale].direction,
    alternates: LOCALES.map((candidate: Locale) => ({
      locale: candidate,
      languageTag: LOCALE_METADATA[candidate].languageTag,
      url: `${SITE_ORIGIN}/${candidate}/image-compressor`,
    })),
    structuredData,
  } as const;
}
