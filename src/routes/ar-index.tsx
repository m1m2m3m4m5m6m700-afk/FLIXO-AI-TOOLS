import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ArHomePage } from './ar-home-page';
import { buildHreflang, localizedPath } from '../lib/seo';
import { LOCALE_METADATA } from '../lib/i18n';

const SEO_TITLE = 'FLIXO | أدوات سريعة وخصوصية أولًا';
const SEO_DESCRIPTION = 'اكتشف أدوات سريعة للصور والذكاء الاصطناعي وOCR والتحويل وغيرها، مع معالجة محلية داخل المتصفح عندما تكون مدعومة.';
const SEO_PATH = '/';

export const arIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ar/',
  head: () => ({
    meta: [
      { title: SEO_TITLE },
      { name: 'description', content: SEO_DESCRIPTION },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: SEO_TITLE },
      { property: 'og:description', content: SEO_DESCRIPTION },
      { property: 'og:locale', content: LOCALE_METADATA.ar.languageTag },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SEO_TITLE },
      { name: 'twitter:description', content: SEO_DESCRIPTION },
    ],
    links: [
      { rel: 'canonical', href: localizedPath('ar', SEO_PATH) },
      ...buildHreflang(SEO_PATH).map(({ hreflang, href }) => ({
        rel: 'alternate',
        hrefLang: hreflang,
        href,
      })),
    ],
  }),
  component: ArHomePage,
});
