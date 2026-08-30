import { createRoute, useParams } from '@tanstack/react-router';
import { isLocale } from '@/lib/i18n';
import { getTranslationBundle } from '@/lib/i18n/translations';
import { buildSeoMetadata } from '../lib/seo';
import { HomePage } from './home-page';
import { rootRoute } from './__root';

export const localizedHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale',
  head: async ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : 'en';
    const bundle = await getTranslationBundle(locale);
    const seo = buildSeoMetadata({
      locale,
      path: '/',
      title: `${bundle.siteName} | ${bundle.homeTitle}`,
      description: bundle.homeDescription,
    });
    const direction = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';

    return {
      meta: [
        { title: seo.title },
        { name: 'description', content: seo.description },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:title', content: seo.title },
        { property: 'og:description', content: seo.description },
        { property: 'og:locale', content: seo.language },
      ],
      links: [
        { rel: 'canonical', href: seo.canonical },
        ...seo.alternates.map(({ hreflang, href }) => ({ rel: 'alternate', hrefLang: hreflang, href })),
      ],
      scripts: [
        {
          type: 'text/javascript',
          children: `document.documentElement.lang=${JSON.stringify(bundle.languageTag)};document.documentElement.dir=${JSON.stringify(direction)};`,
        },
        {
          type: 'application/ld+json',
          children: JSON.stringify(seo.structuredData).replace(/</g, '\\u003c'),
        },
      ],
    };
  },
  component: function LocalizedHomeRoute() {
    const { locale: rawLocale } = useParams({ from: '/$locale' });
    const locale = isLocale(rawLocale) ? rawLocale : 'en';
    return <HomePage locale={locale} />;
  },
});
