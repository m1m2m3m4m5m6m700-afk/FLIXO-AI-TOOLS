import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { HomePage } from './home-page';
import { buildHreflang, localizedPath } from '../lib/seo';
import { LOCALE_METADATA } from '../lib/i18n';

const SEO_TITLE = 'FLIXO | Fast Private Browser Tools';
const SEO_DESCRIPTION = 'Find fast browser-first tools for images, AI, OCR, conversion, and more. Start instantly with privacy-focused processing.';
const SEO_PATH = '/';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  head: () => ({
    meta: [
      { title: SEO_TITLE },
      { name: 'description', content: SEO_DESCRIPTION },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: SEO_TITLE },
      { property: 'og:description', content: SEO_DESCRIPTION },
      { property: 'og:locale', content: LOCALE_METADATA.en.languageTag },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SEO_TITLE },
      { name: 'twitter:description', content: SEO_DESCRIPTION },
    ],
    links: [
      { rel: 'canonical', href: localizedPath('en', SEO_PATH) },
      ...buildHreflang(SEO_PATH).map(({ hreflang, href }) => ({
        rel: 'alternate',
        hrefLang: hreflang,
        href,
      })),
    ],
  }),
  component: HomePage,
});
