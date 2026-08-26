import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { IMAGE_TOOLS } from '../config/tool-definitions/image';
import { rootRoute } from './__root';

const LazyToolChainPanel = lazy(() =>
  import('../components/tool-chain-panel').then((module) => ({
    default: module.ToolChainPanel,
  })),
);

type ImageToolRouteConfig = (typeof IMAGE_TOOLS)[number];

function createImageToolRoute(tool: ImageToolRouteConfig, path = tool.path) {
  if (!tool.isReady) {
    throw new Error(`Route points to a non-ready tool: ${tool.id}`);
  }

  const ToolComponent = tool.component;

  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    head: () => ({
      meta: [
        { title: `${tool.title} | FLIXO` },
        { name: 'description', content: tool.description },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:title', content: `${tool.title} | FLIXO` },
        { property: 'og:description', content: tool.description },
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

const imageToolRouteEntries = IMAGE_TOOLS.flatMap((tool) => [
  createImageToolRoute(tool),
  ...(tool.aliases ?? [])
    .filter((alias) => alias.startsWith('/en/'))
    .map((alias) => createImageToolRoute(tool, alias)),
]);

export const imageToolRoutes = Object.freeze(imageToolRouteEntries);
