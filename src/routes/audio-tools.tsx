import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/audio-extractor-muter');
if (!tool) throw new Error('Missing ToolConfig for /en/audio-extractor-muter');
if (!tool.isReady) throw new Error('Audio Extractor & Muter route is not ready');
const ToolComponent = tool.component;

export const enAudioExtractorMuterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/audio-extractor-muter',
  head: () => ({ meta: [
    { title: 'Audio Extractor & Muter | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Audio Extractor & Muter | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
