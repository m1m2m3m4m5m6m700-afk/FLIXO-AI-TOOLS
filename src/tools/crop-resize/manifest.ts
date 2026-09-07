import { getToolSeoManifest } from '@/lib/seo/tool-manifests';
import type { ToolManifest } from '@/lib/seo/tool-manifest';

export type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';

export const CROP_RESIZE_MANIFEST: ToolManifest = getToolSeoManifest('crop-resize')!;
