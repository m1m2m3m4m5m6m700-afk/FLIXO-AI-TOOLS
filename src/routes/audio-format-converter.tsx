import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';
const tool = getToolConfigByPath('/en/audio-format-converter');
if (!tool) throw new Error('Missing ToolConfig for /en/audio-format-converter');
if (!tool.isReady) throw new Error('Audio Format Converter route is not ready');
const ToolComponent = tool.component;
export const enAudioFormatConverterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/audio-format-converter',
  head: () => ({ meta: [
    { title: 'Audio Format Converter | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Audio Format Converter | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
