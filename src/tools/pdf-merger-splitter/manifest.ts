import { buildToolSeoManifest } from '@/lib/seo/tool-catalog';
import type { ToolManifest } from '@/lib/seo/tool-manifest';

export const PDF_MERGER_SPLITTER_MANIFEST: ToolManifest = buildToolSeoManifest({
  id: 'pdf-merger-splitter',
  title: 'PDF Merger & Splitter',
  path: '/en/pdf-merger-splitter',
  description: 'Merge, reorder, rotate, delete, and split PDF pages locally in your browser.',
  category: 'Other',
  isReady: true,
});
