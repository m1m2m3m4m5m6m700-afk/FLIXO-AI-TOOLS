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

const imageToPdfTool = getToolConfigByPath('/en/image-to-pdf');
if (!imageToPdfTool) throw new Error('Missing ToolConfig for /en/image-to-pdf');
if (!imageToPdfTool.isReady) throw new Error('Image to PDF route is not ready');
const ImageToPdfComponent = imageToPdfTool.component;

export const enImageToPdfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/image-to-pdf',
  head: () => ({ meta: [
    { title: 'Image to PDF | FLIXO' },
    { name: 'description', content: 'Convert JPG, PNG, and WEBP images into a PDF locally in your browser.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'Image to PDF | FLIXO' },
    { property: 'og:description', content: 'Convert JPG, PNG, and WEBP images into a PDF locally in your browser.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <ImageToPdfComponent />,
});

const unlockProtectTool = getToolConfigByPath('/en/pdf-unlock-protect');
if (!unlockProtectTool) throw new Error('Missing ToolConfig for /en/pdf-unlock-protect');
if (!unlockProtectTool.isReady) throw new Error('PDF Unlock & Protect route is not ready');
const UnlockProtectComponent = unlockProtectTool.component;

export const enPdfUnlockProtectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-unlock-protect',
  head: () => ({ meta: [
    { title: 'PDF Unlock & Protect | FLIXO' },
    { name: 'description', content: 'Password-protect or unlock PDF files locally in your browser.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'PDF Unlock & Protect | FLIXO' },
    { property: 'og:description', content: 'Password-protect or unlock PDF files locally in your browser.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <UnlockProtectComponent />,
});

const pdfToTextTool = getToolConfigByPath('/en/pdf-to-text');
if (!pdfToTextTool) throw new Error('Missing ToolConfig for /en/pdf-to-text');
if (!pdfToTextTool.isReady) throw new Error('PDF to Text route is not ready');
const PdfToTextComponent = pdfToTextTool.component;

export const enPdfToTextRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-to-text',
  head: () => ({ meta: [
    { title: 'PDF to Text | FLIXO' },
    { name: 'description', content: 'Extract selectable PDF text locally with page-level search and TXT/JSON export.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'PDF to Text | FLIXO' },
    { property: 'og:description', content: 'Extract selectable PDF text locally with page-level search and TXT/JSON export.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <PdfToTextComponent />,
});
