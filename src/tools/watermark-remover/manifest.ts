import { getToolSeoManifest } from '@/lib/seo/tool-manifests';
import type { ToolManifest } from '@/lib/seo/tool-manifest';
export type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';
export const WATERMARK_REMOVER_MANIFEST: ToolManifest = getToolSeoManifest('watermark-remover')!;
