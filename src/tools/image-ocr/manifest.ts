import { uk } from './seo/uk';
import { ms } from './seo/ms';
import type { ToolManifest } from '@/lib/seo/tool-manifest';
import { ar } from './seo/ar'; import { de } from './seo/de'; import { en } from './seo/en'; import { es } from './seo/es'; import { fr } from './seo/fr'; import { hi } from './seo/hi'; import { id } from './seo/id'; import { it } from './seo/it'; import { ja } from './seo/ja'; import { ko } from './seo/ko'; import { nl } from './seo/nl'; import { pl } from './seo/pl'; import { pt } from './seo/pt'; import { ru } from './seo/ru'; import { sv } from './seo/sv'; import { th } from './seo/th'; import { tr } from './seo/tr';  import { vi } from './seo/vi'; 
export const IMAGE_OCR_MANIFEST: ToolManifest = Object.freeze({ toolId:'image-ocr', slug:'image-ocr', status:'ready', seoStatus:'complete', capabilities:['client-side','ocr','image-to-text','download'], seoLocales:Object.freeze({en, ar, es, fr, de, ru, hi, id, ja, pt, it, ko, nl, pl, tr, vi, th, sv, ms, uk}) });
