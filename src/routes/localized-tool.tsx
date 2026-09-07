import { createRoute, notFound, redirect } from '@tanstack/react-router';
import { getToolConfig, getToolConfigByPath } from '../config/tools';
import { getLocalizedToolPath } from '../lib/routing/route-resolver';
import { getToolSeo } from '../lib/seo/tool-seo';
import { LocalizedToolPage } from './localized-tool-page';
import { rootRoute } from './__root';

export const localizedToolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale/$tool',
  loader: ({ params }) => {
    const rawSlug = params.tool;
    const tool = getToolConfigByPath(`/en/${rawSlug}`) ?? getToolConfigByPath(`/${rawSlug}`) ?? getToolConfig(params.tool);
    if (!tool?.isReady) throw notFound();

    const canonicalPath = getLocalizedToolPath(tool, params.locale as Parameters<typeof getLocalizedToolPath>[1]);
    if (canonicalPath !== `/${params.locale}/${rawSlug}`) {
      throw redirect({ to: canonicalPath });
    }

    return { tool };
  },
  notFoundComponent: () => <main><h1>Tool not found</h1></main>,
  head: ({ params }) => {
    const seo = getToolSeo(params.locale, params.tool);
    if (!seo) return { meta: [{ title: 'FLIXO | Tool not found' }, { name: 'robots', content: 'noindex,nofollow' }] };
    return {
      meta: [
        { title: seo.title },
        { name: 'description', content: seo.description },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:title', content: seo.title },
        { property: 'og:description', content: seo.description },
        { property: 'og:url', content: seo.url },
        { property: 'og:locale', content: seo.languageTag },
      ],
      links: [
        { rel: 'canonical', href: seo.url },
        ...seo.alternates.map((alternate) => ({ rel: 'alternate', hrefLang: alternate.languageTag, href: alternate.url })),
        { rel: 'alternate', hrefLang: 'x-default', href: seo.xDefaultUrl },
      ],
    };
  },
  component: LocalizedToolPage,
});
