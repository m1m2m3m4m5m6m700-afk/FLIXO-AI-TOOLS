import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/ai-captioner-srt');
if (!tool) throw new Error('Missing ToolConfig for /en/ai-captioner-srt');
if (!tool.isReady) throw new Error('AI Auto-Captioner route is not ready');
const ToolComponent = tool.component;

export const enAiCaptionerSrtRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/ai-captioner-srt',
  head: () => ({ meta: [
    { title: 'AI Auto-Captioner & SRT Generator | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'AI Auto-Captioner & SRT Generator | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
