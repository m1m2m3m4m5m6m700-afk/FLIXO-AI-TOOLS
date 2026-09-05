import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import type { ToolManifestEntry } from '../config/tool-manifest';
import { getToolsByFamily } from '../config/tool-manifest';
import { rootRoute } from './__root';

const LazyToolChainPanel = lazy(() =>
  import('../components/tool-chain-panel').then((module) => ({
    default: module.ToolChainPanel,
  })),
);

function createImageToolRoute(tool: ToolManifestEntry, path = tool.path) {
  if (!tool.isReady) {
    throw new Error(`Route points to a non-ready tool: ${tool.id}`);
  }

  const ToolComponent = tool.component;

  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    head: () => ({
      meta: [
        { title: tool.seo.title },
        { name: 'description', content: tool.seo.description },
        { name: 'robots', content: tool.seo.robots },
        { property: 'og:title', content: tool.seo.title },
        { property: 'og:description', content: tool.seo.description },
        { property: 'og:type', content: 'website' },
      ],
    }),
    component: () => (
      <>
        <LazyToolChainPanel currentToolId={tool.id} />
        <ToolComponent />
      </>
    ),
  });
}

const imageToolRouteEntries = getToolsByFamily('image')
  .filter((tool) => tool.id !== 'image-compressor')
  .flatMap((tool) => [
    createImageToolRoute(tool),
    ...(tool.aliases ?? [])
      .filter((alias) => alias.startsWith('/en/'))
      .map((alias) => createImageToolRoute(tool, alias)),
  ]);

export const imageToolRoutes = Object.freeze(imageToolRouteEntries);
