import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

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
      { property: 'og:url', content: '/en/image-compressor' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [
      { rel: 'canonical', href: '/en/image-compressor' },
      { rel: 'alternate', hrefLang: 'en', href: '/en/image-compressor' },
      { rel: 'alternate', hrefLang: 'ar', href: '/ar/image-compressor' },
      { rel: 'alternate', hrefLang: 'x-default', href: '/en/image-compressor' },
    ],
    scripts: [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'FLIXO Image Compressor',
        url: '/en/image-compressor',
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
