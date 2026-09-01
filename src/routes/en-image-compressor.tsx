import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { getCanonicalSiteOrigin } from '../config/origin.config';
import { LOCALES, LOCALE_METADATA } from '../lib/i18n/config';

const CANONICAL_ORIGIN = getCanonicalSiteOrigin();

export const enImageCompressorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/image-compressor',
  head: () => ({
    meta: [
      { title: 'Compress Images Online Free | FLIXO' },
      { name: 'description', content: 'Compress JPG, PNG, and WebP images online in your browser. Reduce file size, control quality, and resize images without uploading them to a server.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: 'Compress Images Online Free | FLIXO' },
      { property: 'og:description', content: 'Reduce image file size, control quality, and resize images without uploading them to a server.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${CANONICAL_ORIGIN}/en/image-compressor` },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [
      { rel: 'canonical', href: `${CANONICAL_ORIGIN}/en/image-compressor` },
      ...LOCALES.map((locale) => ({ rel: 'alternate' as const, hrefLang: LOCALE_METADATA[locale].languageTag, href: `${CANONICAL_ORIGIN}/${locale}/image-compressor` })),
      { rel: 'alternate', hrefLang: 'x-default', href: `${CANONICAL_ORIGIN}/en/image-compressor` },
    ],
    scripts: [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'FLIXO Image Compressor',
        url: `${CANONICAL_ORIGIN}/en/image-compressor`,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        description: 'Compress JPG, PNG, and WebP images online in your browser.',
        inLanguage: 'en',
        isAccessibleForFree: true,
      }),
    }],
  }),
  component: lazy(() =>
    import('../tools/image-compressor/locale-pages').then((module) => ({ default: module.EnglishImageCompressorPage })),
  ),
});
