import { TOOL_CATALOG } from '@/config/registry';
import {
  ROADMAP_CATEGORIES,
  roadmapCategoryById,
  type RoadmapCategory,
} from '@/data/roadmap-categories';

export type AssistantMatch = {
  kind: 'match';
  category: RoadmapCategory;
  toolId?: string;
  toolTitle?: string;
  toolPath?: string;
  confidence: number;
  matchedKeywords: string[];
};

export type AssistantFallback = {
  kind: 'fallback';
  requestTool: true;
  matchedKeywords: [];
};

export type AssistantResult = AssistantMatch | AssistantFallback;

const KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  translation: ['translate', 'translation', 'language', 'arabic', 'english', 'ترجم', 'ترجمة', 'لغة'],
  images: ['image', 'photo', 'picture', 'background', 'upscale', 'crop', 'compress', 'png', 'jpg', 'صورة', 'صور'],
  pdf: ['pdf', 'document', 'merge pdf', 'split pdf', 'مستند', 'ملف pdf'],
  writing: ['write', 'writing', 'summarize', 'summary', 'rewrite', 'email', 'grammar', 'اكتب', 'لخص', 'كتابة'],
  video: ['video', 'clip', 'mp4', 'trim', 'crop video', 'فيديو'],
  audio: ['audio', 'sound', 'voice', 'speech', 'transcribe', 'mp3', 'صوت'],
  files: ['file', 'zip', 'archive', 'unzip', 'folder', 'metadata', 'ملفات'],
  utilities: ['qr', 'password', 'uuid', 'diff', 'compare', 'أداة'],
  converters: ['convert', 'converter', 'convert to', 'base64', 'csv', 'encode', 'decode', 'تحويل'],
  calculators: ['calculate', 'calculator', 'percentage', 'loan', 'interest', 'bmi', 'احسب', 'حاسبة'],
  web: ['url', 'link', 'website', 'seo', 'meta', 'sitemap', 'headers', 'موقع'],
  developer: ['json', 'regex', 'jwt', 'cron', 'code', 'api', 'developer', 'برمجة', 'كود'],
  ai: ['ai', 'chat', 'assistant', 'prompt', 'gpt', 'insight', 'ذكاء'],
  future: ['workflow', 'automation', 'team', 'integration', 'سير عمل', 'أتمتة'],
};

const TOOL_HINTS: Readonly<Record<string, string[]>> = {
  'background-remover': ['background', 'remove background', 'إزالة الخلفية'],
  'image-upscaler': ['upscale', 'resolution', 'higher quality', 'زيادة الدقة'],
  'image-cropper': ['crop', 'resize', 'dimensions', 'قص', 'تغيير الحجم'],
  'image-compressor': ['compress', 'smaller', 'file size', 'ضغط', 'تصغير'],
  'image-converter': ['convert', 'format', 'jpg', 'png', 'webp', 'تحويل'],
  'image-effects': ['brightness', 'contrast', 'saturation', 'grayscale', 'تباين', 'سطوع'],
  translator: ['translate', 'translation', 'ترجم', 'ترجمة'],
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readyToolForPrompt(prompt: string): (typeof TOOL_CATALOG.ready)[number] | undefined {
  const text = normalize(prompt);
  const direct = Object.entries(TOOL_HINTS)
    .map(([toolId, hints]) => ({
      tool: TOOL_CATALOG.ready.find((candidate) => candidate.id === toolId),
      score: hints.reduce((score, hint) => score + (text.includes(normalize(hint)) ? 1 : 0), 0),
    }))
    .filter((entry): entry is {
      tool: (typeof TOOL_CATALOG.ready)[number];
      score: number;
    } => Boolean(entry.tool) && entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (direct[0]) return direct[0].tool;

  return TOOL_CATALOG.ready.find((tool) => {
    const signals = [tool.title, tool.description, ...tool.aliases, ...tool.capability.intents];
    return signals.some((signal) => {
      const normalized = normalize(signal);
      return normalized.length > 2 && text.includes(normalized);
    });
  });
}

export function classifyHomeIntent(prompt: string): AssistantResult {
  const text = normalize(prompt);
  if (!text) return { kind: 'fallback', requestTool: true, matchedKeywords: [] };

  const scored = ROADMAP_CATEGORIES.map((category) => {
    const matches = (KEYWORDS[category.id] ?? []).filter((keyword) =>
      text.includes(normalize(keyword)),
    );
    return { category, matches };
  }).sort(
    (a, b) => b.matches.length - a.matches.length || a.category.order - b.category.order,
  );

  const best = scored[0];
  if (!best || best.matches.length === 0) {
    return { kind: 'fallback', requestTool: true, matchedKeywords: [] };
  }

  const tool = readyToolForPrompt(prompt);
  const confidence = Math.min(0.96, 0.42 + best.matches.length * 0.18);

  return {
    kind: 'match',
    category: best.category,
    toolId: tool?.id,
    toolTitle: tool?.title,
    toolPath: tool?.routes.ar ?? tool?.routes.en,
    confidence,
    matchedKeywords: best.matches.slice(0, 5),
  };
}

export const getRoadmapCategory = (id: string) => roadmapCategoryById.get(id);
