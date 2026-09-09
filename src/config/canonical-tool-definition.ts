import { lazy } from 'react';
import { z, type ZodType } from 'zod';
import { LOCALES, type Locale } from '@/lib/i18n/config.ts';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { ToolConfig, ToolFamily } from './tool-definitions/types.ts';

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
  capability: Readonly<{ state: CapabilityState; intents: readonly string[] }>;
  executionMode: ExecutionMode;
  parameterSchema: ZodType;
  safetyLimits: CapabilityLimits;
  verifier: CapabilityVerifier;
  localization: Readonly<{ titleKey: string; descriptionKey: string }>;
  seo: Readonly<{ title: string; description: string; robots: 'index,follow,max-image-preview:large' }>;
}>;

const IMAGE_TOOL_CONFIGS: readonly ToolConfig[] = Object.freeze([
  { id: 'image-compressor', title: 'Image Compressor', path: '/en/image-compressor', description: 'Reduce JPG, PNG, and WebP file size in your browser.', category: 'Images', isReady: true, aliases: ['/ar/image-compressor'], component: lazy(() => import('@/tools/image-compressor/index.tsx').then((m) => ({ default: m.ImageCompressor }))) },
  { id: 'background-remover', title: 'Background Remover', path: '/en/background-remover', description: 'Remove connected, uniform backgrounds locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/background-remover').then((m) => ({ default: m.BackgroundRemoverTool }))) },
  { id: 'image-upscaler', title: 'Image Upscaler', path: '/en/image-upscaler', description: 'Increase image dimensions with high-quality resampling.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-upscaler').then((m) => ({ default: m.ImageUpscalerTool }))) },
  { id: 'image-converter', title: 'Image Converter', path: '/en/image-converter', description: 'Convert common raster image formats locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-converter').then((m) => ({ default: m.ImageConverterTool }))) },
  { id: 'object-remover', title: 'Object Remover', path: '/en/object-remover', description: 'Remove selected rectangular regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/object-remover').then((m) => ({ default: m.ObjectRemoverTool }))) },
  { id: 'watermark-remover', title: 'Watermark Remover', path: '/en/watermark-remover', description: 'Clean selected watermark regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/watermark-remover').then((m) => ({ default: m.WatermarkRemoverTool }))) },
  { id: 'image-cropper', title: 'Image Cropper', path: '/en/image-cropper', description: 'Crop and resize images for exact dimensions.', category: 'Images', isReady: true, aliases: ['/en/crop-resize'], component: lazy(() => import('@/tools/image-cropper')) },
  { id: 'image-to-svg', title: 'Image to SVG', path: '/en/image-to-svg', description: 'Convert a raster image to downloadable SVG.', category: 'Images', isReady: true, aliases: ['/en/raster-to-svg'], component: lazy(() => import('@/tools/image-to-svg')) },
  { id: 'image-ocr', title: 'Image OCR', path: '/en/image-ocr', description: 'Extract text from images with OCR.', category: 'Images', isReady: true, aliases: ['/en/image-to-text'], component: lazy(() => import('@/tools/image-ocr')) },
  { id: 'background-blur', title: 'Background Blur', path: '/en/background-blur', description: 'Blur background regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/background-blur')) },
  { id: 'passport-photo-maker', title: 'Passport Photo Maker', path: '/en/passport-photo-maker', description: 'Create standard portrait photo crops.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/passport-photo-maker')) },
  { id: 'watermark-adder', title: 'Watermark Adder', path: '/en/watermark-adder', description: 'Add text watermarks locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/watermark-adder')) },
  { id: 'meme-generator', title: 'Meme Generator', path: '/en/meme-generator', description: 'Create top-and-bottom captioned memes.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/meme-generator')) },
  { id: 'collage-maker', title: 'Collage Maker', path: '/en/collage-maker', description: 'Combine multiple images into a collage.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/collage-maker')) },
  { id: 'image-effects', title: 'Image Effects', path: '/en/image-effects', description: 'Apply brightness, contrast, saturation, and grayscale.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-effects')) },
  { id: 'exif-cleaner', title: 'EXIF Cleaner', path: '/en/exif-cleaner', description: 'Strip metadata by browser re-encoding.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/exif-cleaner')) },
  { id: 'svg-optimizer', title: 'SVG Optimizer', path: '/en/svg-optimizer', description: 'Minify SVG comments and whitespace.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/svg-optimizer')) },
  { id: 'mockup-generator', title: 'Mockup Generator', path: '/en/mockup-generator', description: 'Place images inside a simple device mockup.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/mockup-generator')) },
  { id: 'seed', title: 'Seed', path: '/en/seed', description: 'Non-destructive GPU image adjustments with WebGL.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/seed')) },
  { id: 'pix', title: 'Pix Studio', path: '/en/pix', description: 'Professional browser-based image editor with tune, liquify, dispersion, text, history, and PNG export.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/pix')) },
  { id: 'ai-image-generator', title: 'AI Image Generator', path: '/en/ai-image-generator', description: 'Generate images through a configured image endpoint.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/ai-image-generator').then((m) => ({ default: m.AiImageGeneratorTool }))) },
  { id: 'photo-colorizer', title: 'Photo Colorizer', path: '/en/photo-colorizer', description: 'Colorize photos through a configured AI endpoint.', category: 'Images', isReady: false, component: lazy(() => import('@/tools/photo-colorizer')) },
]);

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
  const capabilityState = stateFor(tool);
  const executionMode: ExecutionMode = tool.id === 'ai-image-generator' || tool.id === 'photo-colorizer' ? 'CLOUD' : 'LOCAL';
  const parameterSchema = PARAMETER_SCHEMAS[tool.id] ?? COMMON_PARAMETERS;
  const safetyLimits = Object.freeze({ maxPixels: DEFAULT_MAX_PIXELS, maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES, timeoutMs: DEFAULT_TIMEOUT_MS });
  const verifier = verifierFor(tool.id);
  const intents = Object.freeze(TOOL_INTENTS[tool.id] ?? []);
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
    capability: Object.freeze({ state: capabilityState, intents }),
    executionMode,
    parameterSchema,
    safetyLimits,
    verifier,
    localization: Object.freeze({ titleKey: `tool.${tool.id}.title`, descriptionKey: `tool.${tool.id}.description` }),
    seo: Object.freeze({ title: `${tool.title} | FLIXO`, description: tool.description, robots: 'index,follow,max-image-preview:large' as const }),
  });
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = Object.freeze(IMAGE_TOOL_CONFIGS.map(toToolDefinition));

const byId = new Map(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));
export function getToolDefinition(id: string): ToolDefinition | undefined { return byId.get(id); }
