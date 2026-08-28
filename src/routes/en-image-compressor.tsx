import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { getImageCompressorHeadSeo } from '../lib/seo/image-compressor-head';
import { rootRoute } from './__root';

const seo = getImageCompressorHeadSeo('en');

export const enImageCompressorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/image-compressor',
  head: () => ({
    meta: [
      { title: seo.title },
      { name: 'description', content: seo.description },
      { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' },
      { property: 'og:title', content: seo.title },
      { property: 'og:description', content: seo.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: seo.url },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'canonical', href: seo.url },
      ...seo.alternates.map((alternate) => ({ rel: 'alternate', hrefLang: alternate.languageTag, href: alternate.url })),
      { rel: 'alternate', hrefLang: 'x-default', href: seo.xDefaultUrl },
    ],
    scripts: [{
      type: 'application/ld+json',
      children: JSON.stringify(seo.structuredData).replaceAll('<', '\\u003c'),
    }],
  }),
  component: lazy(() =>
    import('../tools/image-compressor/locale-pages').then((module) => ({ default: module.EnglishImageCompressorPage })),
  ),
});
