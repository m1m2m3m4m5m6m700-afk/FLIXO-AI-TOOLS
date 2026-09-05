import type { ToolConfig } from '../config/tools';

export type IntentMatch = {
  readonly tool: ToolConfig;
  readonly score: number;
};

const ALIASES: Record<string, readonly string[]> = {
  'image-compressor': ['compress image', 'compress photo', 'reduce image size', 'resize image', 'ضغط الصورة', 'ضغط الصور'],
  'background-remover': ['remove background', 'background removal', 'transparent background', 'إزالة الخلفية', 'تفريغ الصورة'],
  'image-ocr': ['ocr', 'extract text', 'read text from image', 'نسخ النص من الصورة', 'استخراج النص'],
  'image-converter': ['convert image', 'png to webp', 'jpg to png', 'image format', 'تحويل الصورة', 'تحويل png'],
  'image-upscaler': ['upscale image', 'increase resolution', 'enhance image', 'تكبير الصورة', 'رفع جودة الصورة'],
  'image-cropper': ['crop image', 'crop photo', 'قص الصورة', 'قص الصور'],
  'watermark-adder': ['add watermark', 'watermark image', 'إضافة علامة مائية'],
  'watermark-remover': ['remove watermark', 'إزالة العلامة المائية'],
  'object-remover': ['remove object', 'erase object', 'إزالة عنصر', 'حذف عنصر من الصورة'],
  'background-blur': ['blur background', 'background blur', 'طمس الخلفية'],
  'passport-photo-maker': ['passport photo', 'id photo', 'صورة جواز السفر', 'صورة شخصية'],
  'meme-generator': ['make meme', 'meme', 'إنشاء ميم'],
  'collage-maker': ['photo collage', 'make collage', 'كولاج', 'دمج الصور'],
  'image-effects': ['image effects', 'brightness contrast', 'تأثيرات الصور'],
  'exif-cleaner': ['remove metadata', 'exif', 'تنظيف exif', 'حذف بيانات الصورة'],
  'svg-optimizer': ['optimize svg', 'minify svg', 'تحسين svg'],
  'image-to-svg': ['image to svg', 'convert image to svg', 'صورة إلى svg'],
  pix: ['photo editor', 'image editor', 'edit image', 'محرر الصور', 'تعديل الصور'],
  seed: ['gpu image editor', 'advanced image adjustments', 'تحسينات متقدمة للصورة'],
};

const normalize = (value: string): string =>
  value
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const scoreMatch = (query: string, tool: ToolConfig): number => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const candidates = [tool.id, tool.title, tool.description, ...(ALIASES[tool.id] ?? [])].map(normalize);
  let score = 0;

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === normalizedQuery) score = Math.max(score, 100);
    else if (candidate.includes(normalizedQuery)) score = Math.max(score, 85);
    else if (normalizedQuery.includes(candidate)) score = Math.max(score, 75);
    else {
      const tokens = normalizedQuery.split(' ');
      const hits = tokens.filter((token) => token.length > 1 && candidate.includes(token)).length;
      if (hits) score = Math.max(score, Math.round((hits / tokens.length) * 70));
    }
  }

  return score;
};

export const findToolIntent = (query: string, tools: readonly ToolConfig[]): IntentMatch[] =>
  tools
    .filter((tool) => tool.isReady)
    .map((tool) => ({ tool, score: scoreMatch(query, tool) }))
    .filter(({ score }) => score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

export const getBestToolIntent = (query: string, tools: readonly ToolConfig[]): IntentMatch | null =>
  findToolIntent(query, tools)[0] ?? null;
