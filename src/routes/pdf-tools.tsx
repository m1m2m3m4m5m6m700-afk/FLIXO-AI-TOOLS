import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const mergerSplitterTool = getToolConfigByPath('/en/pdf-merger-splitter');
if (!mergerSplitterTool) throw new Error('Missing ToolConfig for /en/pdf-merger-splitter');
if (!mergerSplitterTool.isReady) throw new Error('PDF Merger & Splitter route is not ready');
const MergerSplitterComponent = mergerSplitterTool.component;

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
  component: () => <MergerSplitterComponent />,
});

const compressorTool = getToolConfigByPath('/en/pdf-compressor');
if (!compressorTool) throw new Error('Missing ToolConfig for /en/pdf-compressor');
if (!compressorTool.isReady) throw new Error('PDF Compressor route is not ready');
const CompressorComponent = compressorTool.component;

export const enPdfCompressorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-compressor',
  head: () => ({ meta: [
    { title: 'PDF Compressor | FLIXO' },
    { name: 'description', content: 'Compress PDF files locally in your browser by re-encoding pages.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'PDF Compressor | FLIXO' },
    { property: 'og:description', content: 'Compress PDF files locally in your browser by re-encoding pages.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <CompressorComponent />,
});
