import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { getCanonicalSiteOrigin } from '../config/origin.config';
import { LOCALES, LOCALE_METADATA } from '../lib/i18n/config';

const CANONICAL_ORIGIN = getCanonicalSiteOrigin();

export const arImageCompressorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ar/image-compressor',
  head: () => ({
    meta: [
      { title: 'ضغط الصور أونلاين مجانًا | FLIXO' },
      { name: 'description', content: 'اضغط صور JPG وPNG وWebP أونلاين داخل المتصفح. قلّل حجم الملفات وتحكم في الجودة والمقاسات بدون رفع الصور إلى خادم.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: 'ضغط الصور أونلاين مجانًا | FLIXO' },
      { property: 'og:description', content: 'قلّل حجم الصور داخل المتصفح مع التحكم في الجودة والمقاسات.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${CANONICAL_ORIGIN}/ar/image-compressor` },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [
      { rel: 'canonical', href: `${CANONICAL_ORIGIN}/ar/image-compressor` },
      ...LOCALES.map((locale) => ({ rel: 'alternate' as const, hrefLang: LOCALE_METADATA[locale].languageTag, href: `${CANONICAL_ORIGIN}/${locale}/image-compressor` })),
      { rel: 'alternate', hrefLang: 'x-default', href: `${CANONICAL_ORIGIN}/en/image-compressor` },
    ],
    scripts: [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'FLIXO ضاغط الصور',
        url: `${CANONICAL_ORIGIN}/ar/image-compressor`,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        description: 'اضغط صور JPG وPNG وWebP أونلاين داخل المتصفح.',
        inLanguage: 'ar',
        isAccessibleForFree: true,
      }),
    }],
  }),
  component: lazy(() =>
    import('../tools/image-compressor/locale-pages').then((module) => ({ default: module.ArabicImageCompressorPage })),
  ),
});
