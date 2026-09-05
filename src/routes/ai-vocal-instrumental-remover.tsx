import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/ai-vocal-instrumental-remover');
if (!tool) throw new Error('Missing ToolConfig for /en/ai-vocal-instrumental-remover');
if (!tool.isReady) throw new Error('AI Vocal & Instrumental Remover route is not ready');
const ToolComponent = tool.component;

export const enAiVocalInstrumentalRemoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/ai-vocal-instrumental-remover',
  head: () => ({ meta: [
    { title: 'AI Vocal & Instrumental Remover | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'AI Vocal & Instrumental Remover | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
