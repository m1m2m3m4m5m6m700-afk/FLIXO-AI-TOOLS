import { getToolSeoManifest } from '@/lib/seo/tool-manifests';
import type { ToolManifest } from '@/lib/seo/tool-manifest';
export type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';
export const PASSPORT_PHOTO_MAKER_MANIFEST: ToolManifest = getToolSeoManifest('passport-photo-maker')!;
