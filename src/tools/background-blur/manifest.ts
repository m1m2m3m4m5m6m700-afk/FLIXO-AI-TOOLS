import type { ToolManifest } from '@/lib/seo/tool-manifest';
import { en } from './seo/en'; import { ar } from './seo/ar'; import { es } from './seo/es'; import { fr } from './seo/fr'; import { de } from './seo/de';
import { ru } from './seo/ru'; import { zh } from './seo/zh'; import { hi } from './seo/hi'; import { id } from './seo/id'; import { ur } from './seo/ur';
import { ja } from './seo/ja'; import { pt } from './seo/pt'; import { it } from './seo/it'; import { ko } from './seo/ko'; import { nl } from './seo/nl';
import { pl } from './seo/pl'; import { tr } from './seo/tr'; import { vi } from './seo/vi'; import { th } from './seo/th'; import { sv } from './seo/sv';

export const BACKGROUND_BLUR_MANIFEST: ToolManifest = Object.freeze({
  toolId: 'background-blur', slug: 'background-blur', status: 'ready', seoStatus: 'pilot',
  capabilities: ['client-side', 'blur', 'image', 'png', 'jpg', 'webp'] as const,
  seoLocales: Object.freeze({ en, ar, es, fr, de, ru, zh, hi, id, ur, ja, pt, it, ko, nl, pl, tr, vi, th, sv }),
});
