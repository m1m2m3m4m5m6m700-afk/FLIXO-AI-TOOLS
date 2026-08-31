import { createRoute, useParams } from '@tanstack/react-router';
import { isLocale, SITE_ORIGIN } from '@/lib/i18n';
import { getTranslationBundle } from '@/lib/i18n/translations';
import { LOCALE_METADATA } from '@/lib/i18n/config';
import { HomePage } from './home-page';
import { rootRoute } from './__root';

export const localizedHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale',
  head: async ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : 'en';
    const bundle = await getTranslationBundle(locale);
    const direction = LOCALE_METADATA[locale].direction;
    const canonicalUrl = `${SITE_ORIGIN}/${locale}`;
    return {
      meta: [
        { title: `${bundle.siteName} | ${bundle.homeTitle}` },
        { name: 'description', content: bundle.homeDescription },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:title', content: `${bundle.siteName} | ${bundle.homeTitle}` },
        { property: 'og:description', content: bundle.homeDescription },
        { property: 'og:locale', content: bundle.languageTag },
        { property: 'og:url', content: canonicalUrl },
      ],
      links: [
        { rel: 'canonical', href: canonicalUrl },
        { rel: 'alternate', hrefLang: bundle.languageTag, href: canonicalUrl },
        { rel: 'alternate', hrefLang: 'x-default', href: `${SITE_ORIGIN}/en` },
      ],
      scripts: [
        {
          type: 'text/javascript',
          children: `document.documentElement.lang=${JSON.stringify(bundle.languageTag)};document.documentElement.dir=${JSON.stringify(direction)};`,
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
