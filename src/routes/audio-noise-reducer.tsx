import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/audio-noise-reducer');
if (!tool) throw new Error('Missing ToolConfig for /en/audio-noise-reducer');
if (!tool.isReady) throw new Error('Audio Noise Reducer route is not ready');
const ToolComponent = tool.component;

export const enAudioNoiseReducerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/audio-noise-reducer',
  head: () => ({ meta: [
    { title: 'Audio Noise Reducer | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Audio Noise Reducer | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
