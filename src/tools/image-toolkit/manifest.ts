import { getToolSeoManifest } from '@/lib/seo/tool-manifests';
import type { ToolManifest } from '@/lib/seo/tool-manifest';
export type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';
export const IMAGE_TO_TEXT_MANIFEST: ToolManifest = getToolSeoManifest('image-to-text')!;
