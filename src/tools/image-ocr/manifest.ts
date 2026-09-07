import { getToolSeoManifest } from '@/lib/seo/tool-manifests';
import type { ToolManifest } from '@/lib/seo/tool-manifest';
export type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';
export const IMAGE_OCR_MANIFEST: ToolManifest = getToolSeoManifest('image-ocr')!;
