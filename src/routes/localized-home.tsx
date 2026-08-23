import { createRoute, useParams } from '@tanstack/react-router';
import { isLocale } from '@/lib/i18n';
import { getTranslationBundle } from '@/lib/i18n/translations';
import { HomePage } from './home-page';
import { rootRoute } from './__root';

export const localizedHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale',
  head: async ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : 'en';
    const bundle = await getTranslationBundle(locale);
    return {
      meta: [
        { title: `${bundle.siteName} | ${bundle.homeTitle}` },
        { name: 'description', content: bundle.homeDescription },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:title', content: `${bundle.siteName} | ${bundle.homeTitle}` },
        { property: 'og:description', content: bundle.homeDescription },
        { property: 'og:locale', content: bundle.languageTag },
      ],
    };
  },
  component: function LocalizedHomeRoute() {
    const { locale: rawLocale } = useParams({ from: '/$locale' });
    const locale = isLocale(rawLocale) ? rawLocale : 'en';
    return <HomePage locale={locale} />;
  },
});
