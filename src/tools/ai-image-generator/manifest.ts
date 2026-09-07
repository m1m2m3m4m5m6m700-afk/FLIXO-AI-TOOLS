import { getToolSeoManifest } from '@/lib/seo/tool-manifests';
import type { ToolManifest } from '@/lib/seo/tool-manifest';

export type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';

export const AI_IMAGE_GENERATOR_MANIFEST: ToolManifest = getToolSeoManifest('ai-image-generator')!;
