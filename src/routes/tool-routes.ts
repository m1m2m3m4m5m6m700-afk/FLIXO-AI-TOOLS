import { createRoute } from '@tanstack/react-router';
import type { ComponentType } from 'react';
import { getReadyToolConfigs, type ToolConfig } from '../config/tools';
import { rootRoute } from './__root';

const SPECIAL_ALIAS_PATHS = new Set(['/ar/image-compressor']);

function createToolRoute(tool: ToolConfig, path: string) {
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
    component: tool.component as ComponentType,
  });
}

export const toolRoutes = getReadyToolConfigs().flatMap((tool) => {
  const aliases = (tool.aliases ?? []).filter((alias) => !SPECIAL_ALIAS_PATHS.has(alias));
  return [createToolRoute(tool, tool.path), ...aliases.map((alias) => createToolRoute(tool, alias))];
});
