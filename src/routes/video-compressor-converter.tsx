import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/video-compressor-converter');
if (!tool) throw new Error('Missing ToolConfig for /en/video-compressor-converter');
if (!tool.isReady) throw new Error('Video Compressor & Converter route is not ready');
const ToolComponent = tool.component;

export const enVideoCompressorConverterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/video-compressor-converter',
  head: () => ({ meta: [
    { title: 'Video Compressor & Converter | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Video Compressor & Converter | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
