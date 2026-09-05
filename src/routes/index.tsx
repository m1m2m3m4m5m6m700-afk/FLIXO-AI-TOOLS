import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { HomePage } from './home-page';
import { buildSeoMetadata } from '../lib/seo';

const SEO = buildSeoMetadata({
  locale: 'en',
  path: '/',
  title: 'FLIXO | Fast Private Browser Tools',
  description:
    'Find fast browser-first tools for images, AI, OCR, conversion, and more. Start instantly with privacy-focused processing.',
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  head: () => ({
    meta: [
      { title: SEO.title },
      { name: 'description', content: SEO.description },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: SEO.title },
      { property: 'og:description', content: SEO.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SEO.canonical },
      { property: 'og:locale', content: SEO.language },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SEO.title },
      { name: 'twitter:description', content: SEO.description },
    ],
    links: [
      { rel: 'canonical', href: SEO.canonical },
      ...SEO.alternates.map(({ hreflang, href }) => ({
        rel: 'alternate',
        hrefLang: hreflang,
        href,
      })),
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(SEO.structuredData).replace(/</g, '\\u003c'),
      },
    ],
  }),
  component: HomePage,
});
