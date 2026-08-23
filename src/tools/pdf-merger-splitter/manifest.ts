import type { ToolManifest } from '@/lib/seo/tool-manifest';

export const PDF_MERGER_SPLITTER_MANIFEST: ToolManifest = Object.freeze({
  toolId: 'pdf-merger-splitter',
  slug: 'pdf-merger-splitter',
  status: 'ready',
  seoStatus: 'pilot',
  capabilities: ['client-side', 'merge', 'split', 'reorder', 'delete-pages', 'rotate-pages'] as const,
  seoLocales: Object.freeze({}),
});
