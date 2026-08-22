import type { ToolManifest } from '@/lib/seo/tool-manifest';
import { ar } from './seo/ar';
import { en } from './seo/en';

export const IMAGE_CROPPER_MANIFEST: ToolManifest = Object.freeze({
  toolId: 'image-cropper',
  slug: 'image-cropper',
  status: 'ready',
  seoStatus: 'pilot',
  capabilities: ['client-side', 'crop', 'resize', 'png', 'jpg', 'webp'] as const,
  seoLocales: Object.freeze({ en, ar }),
});
