import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/video-gif-meme');
if (!tool) throw new Error('Missing ToolConfig for /en/video-gif-meme');
if (!tool.isReady) throw new Error('Video to GIF & Meme Maker route is not ready');
const ToolComponent = tool.component;

export const enVideoGifMemeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/video-gif-meme',
  head: () => ({ meta: [
    { title: 'Video to GIF & Meme Maker | FLIXO' },
    { name: 'description', content: tool.description },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Video to GIF & Meme Maker | FLIXO' },
    { property: 'og:description', content: tool.description },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
