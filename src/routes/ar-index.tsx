import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ArHomePage } from './ar-home-page';
import { buildSeoMetadata } from '../lib/seo';

const SEO = buildSeoMetadata({
  locale: 'ar',
  path: '/',
  title: 'FLIXO | أدوات سريعة وخصوصية أولًا',
  description:
    'اكتشف أدوات سريعة للصور والذكاء الاصطناعي وOCR والتحويل وغيرها، مع معالجة محلية داخل المتصفح عندما تكون مدعومة.',
});

export const arIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ar/',
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
  component: ArHomePage,
});
