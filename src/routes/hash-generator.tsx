import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/hash-generator');
if (!tool) throw new Error('Missing ToolConfig for /en/hash-generator');
if (!tool.isReady) throw new Error('Hash Generator route is not ready');
const ToolComponent = tool.component;

export const enHashGeneratorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/hash-generator',
  head: () => ({ meta: [
    { title: 'Hash Generator | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Hash Generator | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
