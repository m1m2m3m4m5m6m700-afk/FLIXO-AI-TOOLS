import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/audio-compressor');
if (!tool) throw new Error('Missing ToolConfig for /en/audio-compressor');
if (!tool.isReady) throw new Error('Audio Compressor route is not ready');
const ToolComponent = tool.component;

export const enAudioCompressorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/audio-compressor',
  head: () => ({ meta: [
    { title: 'Audio Compressor | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Audio Compressor | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
