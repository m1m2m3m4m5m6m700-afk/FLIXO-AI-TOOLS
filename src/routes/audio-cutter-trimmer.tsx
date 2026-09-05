import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/audio-cutter-trimmer');
if (!tool) throw new Error('Missing ToolConfig for /en/audio-cutter-trimmer');
if (!tool.isReady) throw new Error('Audio Cutter & Trimmer route is not ready');
const ToolComponent = tool.component;

export const enAudioCutterTrimmerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/audio-cutter-trimmer',
  head: () => ({ meta: [
    { title: 'Audio Cutter & Trimmer | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Audio Cutter & Trimmer | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
