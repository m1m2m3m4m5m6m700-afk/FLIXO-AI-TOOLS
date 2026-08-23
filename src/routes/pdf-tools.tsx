import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const tool = getToolConfigByPath('/en/pdf-merger-splitter');
if (!tool) throw new Error('Missing ToolConfig for /en/pdf-merger-splitter');
if (!tool.isReady) throw new Error('PDF Merger & Splitter route is not ready');
const ToolComponent = tool.component;

export const enPdfMergerSplitterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-merger-splitter',
  head: () => ({ meta: [
    { title: 'PDF Merger & Splitter | FLIXO' },
    { name: 'description', content: 'Merge, reorder, rotate, delete, and split PDF pages locally in your browser.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'PDF Merger & Splitter | FLIXO' },
    { property: 'og:description', content: 'Merge, reorder, rotate, delete, and split PDF pages locally in your browser.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ToolComponent />,
});
