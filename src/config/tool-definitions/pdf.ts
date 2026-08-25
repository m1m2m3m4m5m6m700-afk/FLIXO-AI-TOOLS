import { lazy } from 'react';
import type { ToolConfig } from './types';

export const PDF_TOOLS: readonly ToolConfig[] = Object.freeze([
  { id: 'pdf-merger-splitter', title: 'PDF Merger & Splitter', path: '/en/pdf-merger-splitter', description: 'Merge, reorder, rotate, delete, and split PDF pages locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-merger-splitter').then((m) => ({ default: m.PdfMergerSplitterTool }))) },
  { id: 'pdf-compressor', title: 'PDF Compressor', path: '/en/pdf-compressor', description: 'Re-encode PDF pages locally for smaller browser-generated files.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-compressor').then((m) => ({ default: m.PdfCompressorTool }))) },
  { id: 'image-to-pdf', title: 'Image to PDF', path: '/en/image-to-pdf', description: 'Convert JPG, PNG, and WEBP images into a PDF locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/image-to-pdf').then((m) => ({ default: m.ImageToPdfTool }))) },
  { id: 'pdf-unlock-protect', title: 'PDF Unlock & Protect', path: '/en/pdf-unlock-protect', description: 'Password-protect or unlock PDF files locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-unlock-protect').then((m) => ({ default: m.PdfUnlockProtectTool }))) },
  { id: 'pdf-to-text', title: 'PDF to Text', path: '/en/pdf-to-text', description: 'Extract selectable PDF text locally with page-level search and TXT/JSON export.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-to-text').then((m) => ({ default: m.PdfToTextTool }))) },
]);
