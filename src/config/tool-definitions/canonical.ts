import { z, type ZodType } from 'zod';
import { LOCALES, type Locale } from '@/lib/i18n/config.ts';
import type { ComponentType, LazyExoticComponent } from 'react';
import { IMAGE_TOOLS } from './image.ts';
import type { ToolConfig, ToolFamily } from './types.ts';

export type CapabilityState = 'RECOGNIZED' | 'PLANNABLE' | 'EXECUTABLE' | 'UNAVAILABLE';
export type ExecutionMode = 'LOCAL' | 'HYBRID' | 'CLOUD';
export type CapabilityParameters = Record<string, string | number | boolean>;
export type CapabilityVerifier = (inputBlob: Blob, outputBlob: Blob, parameters: CapabilityParameters) => Promise<boolean>;
export type CapabilityLimits = Readonly<{ maxPixels: number; maxFileSizeBytes: number; timeoutMs: number }>;

export type ToolDefinition = Readonly<{
  id: string;
  family: ToolFamily;
  title: string;
  description: string;
  category: 'Images';
  isReady: boolean;
  path: string;
  routes: Readonly<Record<Locale, string>>;
  aliases: readonly string[];
  component: LazyExoticComponent<ComponentType>;
  capability: Readonly<{
    state: CapabilityState;
    executionMode: ExecutionMode;
    intents: readonly string[];
    parameterSchema: ZodType;
    safetyLimits: CapabilityLimits;
    verifier: CapabilityVerifier;
  }>;
  localization: Readonly<{
    titleKey: string;
    descriptionKey: string;
  }>;
  seo: Readonly<{
    title: string;
    description: string;
    robots: 'index,follow,max-image-preview:large';
  }>;
}>;

const DEFAULT_MAX_PIXELS = 16_000_000;
const DEFAULT_MAX_FILE_SIZE_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
const COMMON_PARAMETERS = z.record(z.string().max(64), z.union([z.string(), z.number().finite(), z.boolean()]));

const PARAMETER_SCHEMAS: Readonly<Record<string, ZodType>> = {
  'background-remover': z.object({ tolerance: z.number().finite().min(0).max(255).optional() }).strict(),
  'image-upscaler': z.object({ scale: z.number().finite().positive().max(8).optional() }).strict(),
  'image-cropper': z.object({ width: z.number().int().positive().max(4000).optional(), height: z.number().int().positive().max(4000).optional(), aspectRatio: z.string().regex(/^\d{1,3}:\d{1,3}$/).optional(), mode: z.literal('exact').optional() }).strict(),
  'image-compressor': z.object({ quality: z.number().finite().min(0.01).max(1).optional(), format: z.enum(MIME_TYPES).optional(), targetSizeKB: z.number().finite().int().positive().max(64 * 1024).optional() }).strict(),
  'image-converter': z.object({ format: z.enum(MIME_TYPES) }).strict(),
  'image-effects': z.object({ brightness: z.number().finite().min(0).max(200).optional(), contrast: z.number().finite().min(0).max(200).optional(), saturate: z.number().finite().min(0).max(200).optional(), grayscale: z.number().finite().min(0).max(100).optional() }).strict(),
};

const TOOL_INTENTS: Readonly<Record<string, readonly string[]>> = {
  'image-compressor': ['compress', 'smaller', 'reduce size', 'file size', 'lighter', 'ضغط الصور', 'تصغير حجم الصورة'],
  'background-remover': ['remove background', 'transparent background', 'cut out background', 'background removal', 'إزالة الخلفية', 'خلفية شفافة'],
  'image-upscaler': ['upscale', 'sharper', 'higher quality', 'increase resolution', 'make it clearer', 'رفع الجودة', 'زيادة الدقة'],
  'image-converter': ['convert format', 'jpg to png', 'png to jpg', 'webp', 'change format', 'تحويل الصيغة', 'تحويل الصورة'],
  'image-ocr': ['ocr', 'extract text', 'text from image', 'read text', 'استخراج النص', 'قراءة النص'],
  'image-cropper': ['crop', 'resize', 'dimensions', 'aspect ratio', 'قص الصورة', 'تغيير الحجم'],
  'image-effects': ['brightness', 'contrast', 'saturation', 'grayscale', 'adjust image', 'سطوع', 'تباين', 'تشبع'],
  'watermark-remover': ['remove watermark', 'erase watermark', 'إزالة العلامة المائية'],
  'object-remover': ['remove object', 'erase object', 'delete object', 'إزالة عنصر', 'حذف عنصر'],
  'ai-image-generator': ['generate image', 'create image with ai', 'text to image', 'make an image', 'إنشاء صورة بالذكاء الاصطناعي'],
};

const EXECUTABLE_IDS = new Set(['background-remover', 'image-upscaler', 'image-cropper', 'image-compressor', 'image-converter', 'image-effects']);
const defaultVerifier: CapabilityVerifier = async (_inputBlob, outputBlob) => outputBlob.size > 0;
const targetSizeVerifier: CapabilityVerifier = async (_inputBlob, outputBlob, parameters) => {
  if (outputBlob.size <= 0) return false;
  const targetSizeKB = typeof parameters.targetSizeKB === 'number' ? parameters.targetSizeKB : undefined;
  return targetSizeKB === undefined ? true : outputBlob.size <= targetSizeKB * 1024;
};
const formatVerifier: CapabilityVerifier = async (_inputBlob, outputBlob, parameters) => {
  const format = parameters.format;
  return outputBlob.size > 0 && (typeof format !== 'string' || outputBlob.type === format);
};
const verifierFor = (toolId: string): CapabilityVerifier => {
  if (toolId === 'image-compressor') return targetSizeVerifier;
  if (toolId === 'image-converter') return formatVerifier;
  return defaultVerifier;
};

const stateFor = (tool: ToolConfig): CapabilityState => {
  if (!tool.isReady) return 'UNAVAILABLE';
  if (EXECUTABLE_IDS.has(tool.id)) return 'EXECUTABLE';
  if (tool.id in TOOL_INTENTS) return 'PLANNABLE';
  return 'RECOGNIZED';
};

function localizedRoute(path: string, locale: Locale): string {
  const route = path.replace(/^\/en(?=\/|$)/, '');
  return `/${locale}${route}`;
}

export function toToolDefinition(tool: ToolConfig): ToolDefinition {
  const routes = Object.fromEntries(LOCALES.map((locale) => [locale, localizedRoute(tool.path, locale)])) as Record<Locale, string>;
  const state = stateFor(tool);
  return Object.freeze({
    id: tool.id,
    family: 'image',
    title: tool.title,
    description: tool.description,
    category: tool.category,
    isReady: tool.isReady,
    path: tool.path,
    routes: Object.freeze(routes),
    aliases: Object.freeze([...(tool.aliases ?? [])]),
    component: tool.component,
    capability: Object.freeze({
      state,
      executionMode: tool.id === 'ai-image-generator' || tool.id === 'photo-colorizer' ? 'CLOUD' : 'LOCAL',
      intents: Object.freeze(TOOL_INTENTS[tool.id] ?? []),
      parameterSchema: PARAMETER_SCHEMAS[tool.id] ?? COMMON_PARAMETERS,
      safetyLimits: Object.freeze({ maxPixels: DEFAULT_MAX_PIXELS, maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES, timeoutMs: DEFAULT_TIMEOUT_MS }),
      verifier: verifierFor(tool.id),
    }),
    localization: Object.freeze({
      titleKey: `tool.${tool.id}.title`,
      descriptionKey: `tool.${tool.id}.description`,
    }),
    seo: Object.freeze({
      title: `${tool.title} | FLIXO`,
      description: tool.description,
      robots: 'index,follow,max-image-preview:large' as const,
    }),
  });
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = Object.freeze(IMAGE_TOOLS.map(toToolDefinition));

const byId = new Map(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));
export function getToolDefinition(id: string): ToolDefinition | undefined {
  return byId.get(id);
}
