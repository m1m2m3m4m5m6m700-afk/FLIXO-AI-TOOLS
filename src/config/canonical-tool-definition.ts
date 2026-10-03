import { createElement, lazy } from 'react';
import { z, type ZodType } from 'zod';
import { LOCALES, type Locale } from '../lib/i18n/config.ts';
import { getCanonicalCapabilityDefinition, MVP_EXECUTABLE_TOOL_IDS as CANONICAL_MVP_IDS, type CanonicalCapabilityDefinition, type CanonicalCapabilityState, type CanonicalExecutionMode, type CanonicalCapabilityParameters, type CanonicalCapabilityVerifier, type CanonicalCapabilityLimits } from './manual-capability-definition';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { LocalToolId } from '../tools/image-toolkit/engine.ts';

export type ToolFamily = 'image' | 'video' | 'audio' | 'ai' | 'editor';
export type ToolCategory = 'Images' | 'Video' | 'Audio' | 'AI' | 'Editor';
export type ToolLifecycle = 'experimental' | 'beta' | 'ready' | 'deprecated';
export type ToolExecution = 'browser-local' | 'browser-worker' | 'remote';
export type ToolContractLevel = 'structural' | 'runtime' | 'artifact';
export type ToolRecoveryPolicy = Readonly<{ maxAttempts: number; replanOnFailure: boolean }>;
export type ToolRequirements = Readonly<{ browser: true; network: boolean }>
export type ToolOperationalProfile = Readonly<{
  lifecycle: ToolLifecycle;
  execution: ToolExecution;
  contracts: readonly ToolContractLevel[];
  executorId: string | null;
  outputContractId: string | null;
}>;
export type ToolSource = Readonly<{
  id: string;
  title: string;
  path: string;
  description: string;
  family?: ToolFamily;
  category: ToolCategory;
  isReady: boolean;
  aliases?: readonly string[];
  component: LazyExoticComponent<ComponentType>;
}>;

// ToolConfig is the canonical source shape consumed by the definition builder.
type ToolConfig = ToolSource;

const createImageToolkitComponent = (toolId: Exclude<LocalToolId, 'ai-image-generator' | 'image-compressor'>) =>
  lazy(() =>
    import('@/tools/image-toolkit').then((m) => ({
      default: ((props: Record<string, unknown>) => createElement(m.ImageToolPage, { ...props, toolId })) as ComponentType,
    })),
  );

export type CapabilityState = CanonicalCapabilityState;
export type ExecutionMode = CanonicalExecutionMode;
export type CapabilityParameters = CanonicalCapabilityParameters;
export type CapabilityVerifier = CanonicalCapabilityVerifier;
export type CapabilityLimits = CanonicalCapabilityLimits;

export type ToolDefinition = Readonly<{
  id: string;
  family: ToolFamily;
  title: string;
  description: string;
  category: ToolCategory;
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
  requirements: ToolRequirements;
  recovery: ToolRecoveryPolicy;
  operational: ToolOperationalProfile;
  localization: Readonly<{ titleKey: string; descriptionKey: string }>;
  seo: Readonly<{ title: string; description: string; robots: 'index,follow,max-image-preview:large' }>;
}>;

const IMAGE_TOOL_CONFIGS: readonly ToolSource[] = Object.freeze([
  { id: 'filter-mask', title: 'Filter Mask', path: '/en/filter-mask', description: 'Live camera filters with instant local preview.', category: 'Images', isReady: true, aliases: ['/en/filters'], component: lazy(() => import('@/tools/filter-mask').then((m) => ({ default: m.FilterMaskTool }))) },
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
  { id: 'image-rotate', title: 'Rotate Image', path: '/en/image-rotate', description: 'Rotate images locally in your browser.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-rotate') },
  { id: 'image-flip-horizontal', title: 'Flip Image Horizontal', path: '/en/image-flip-horizontal', description: 'Flip images horizontally locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-flip-horizontal') },
  { id: 'image-flip-vertical', title: 'Flip Image Vertical', path: '/en/image-flip-vertical', description: 'Flip images vertically locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-flip-vertical') },
  { id: 'image-brightness', title: 'Brightness', path: '/en/image-brightness', description: 'Adjust image brightness locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-brightness') },
  { id: 'image-contrast', title: 'Contrast', path: '/en/image-contrast', description: 'Adjust image contrast locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-contrast') },
  { id: 'image-saturation', title: 'Saturation', path: '/en/image-saturation', description: 'Adjust image saturation locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-saturation') },
  { id: 'image-grayscale', title: 'Grayscale', path: '/en/image-grayscale', description: 'Convert images to grayscale locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-grayscale') },
  { id: 'image-invert', title: 'Invert Colors', path: '/en/image-invert', description: 'Invert image colors locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-invert') },
  { id: 'image-sepia', title: 'Sepia', path: '/en/image-sepia', description: 'Apply a sepia effect locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-sepia') },
  { id: 'image-blur', title: 'Blur', path: '/en/image-blur', description: 'Apply a blur effect locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-blur') },
  { id: 'image-sharpen', title: 'Sharpen', path: '/en/image-sharpen', description: 'Sharpen images locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-sharpen') },
  { id: 'image-resizer', title: 'Resize Image', path: '/en/image-resizer', description: 'Resize images locally with deterministic browser resampling.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-resizer') },
  { id: 'image-hue', title: 'Hue', path: '/en/image-hue', description: 'Shift image hue locally in the browser.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-hue') },
  { id: 'image-pixelate', title: 'Pixelate Image', path: '/en/image-pixelate', description: 'Pixelate an image locally without uploading it.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-pixelate') },
  { id: 'image-padding', title: 'Image Padding', path: '/en/image-padding', description: 'Add transparent padding around an image locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-padding') },
  { id: 'image-rounded-corners', title: 'Rounded Corners', path: '/en/image-rounded-corners', description: 'Add rounded transparent corners to an image locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-rounded-corners') },
  { id: 'video-trimmer', title: 'Video Trimmer', path: '/en/video-trimmer', description: 'Trim a video locally in the browser with WebCodecs-compatible playback and MediaRecorder output.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
  { id: 'video-cropper', title: 'Video Cropper', path: '/en/video-cropper', description: 'Crop a video locally to a deterministic rectangle.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
  { id: 'video-resizer', title: 'Video Resizer', path: '/en/video-resizer', description: 'Resize a video locally to exact output dimensions.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
  { id: 'video-compressor', title: 'Video Compressor', path: '/en/video-compressor', description: 'Compress a video locally with bounded browser recording bitrate.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
]);

const DEFAULT_MAX_PIXELS = 16_000_000;
const DEFAULT_MAX_FILE_SIZE_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
const COMMON_PARAMETERS = z.record(z.string().max(64), z.union([z.string(), z.number().finite(), z.boolean()]));

const PARAMETER_SCHEMAS: Readonly<Record<string, ZodType>> = {
  'background-remover': z.object({ tolerance: z.number().finite().min(0).max(255).optional() }).strict(),
  'image-upscaler': z.object({ scale: z.number().finite().positive().max(8).optional() }).strict(),
  'image-cropper': z.object({ x: z.number().int().nonnegative().max(40_000).optional(), y: z.number().int().nonnegative().max(40_000).optional(), cropWidth: z.number().int().positive().max(40_000).optional(), cropHeight: z.number().int().positive().max(40_000).optional(), width: z.number().int().positive().max(4000).optional(), height: z.number().int().positive().max(4000).optional(), aspectRatio: z.string().regex(/^\d{1,3}:\d{1,3}$/).optional(), mode: z.literal('exact').optional() }).strict(),
  'image-compressor': z.object({ quality: z.number().finite().min(0.01).max(1).optional(), format: z.enum(MIME_TYPES).optional(), targetSizeKB: z.number().finite().int().positive().max(64 * 1024).optional(), maxWidth: z.number().int().positive().max(4000).optional(), maxHeight: z.number().int().positive().max(4000).optional() }).strict(),
  'image-converter': z.object({ format: z.enum(MIME_TYPES) }).strict(),
  'image-effects': z.object({ brightness: z.number().finite().min(0).max(200).optional(), contrast: z.number().finite().min(0).max(200).optional(), saturate: z.number().finite().min(0).max(200).optional(), grayscale: z.number().finite().min(0).max(100).optional() }).strict(),
  'image-resizer': z.object({ scale: z.number().finite().positive().min(0.1).max(8).optional() }).strict(),
  'image-hue': z.object({ degrees: z.number().finite().min(-360).max(360).optional() }).strict(),
  'image-pixelate': z.object({ blockSize: z.number().int().min(2).max(64).optional() }).strict(),
  'image-padding': z.object({ padding: z.number().int().min(0).max(2000).optional() }).strict(),
  'image-rounded-corners': z.object({ radius: z.number().int().min(0).max(4000).optional() }).strict(),
  'video-trimmer': z.object({ startSec: z.number().finite().min(0).max(86_400).optional(), endSec: z.number().finite().min(0).max(86_400).optional() }).strict(),
  'video-cropper': z.object({ x: z.number().finite().min(0).max(20_000).optional(), y: z.number().finite().min(0).max(20_000).optional(), width: z.number().int().positive().max(20_000), height: z.number().int().positive().max(20_000) }).strict(),
  'video-resizer': z.object({ width: z.number().int().positive().max(8000), height: z.number().int().positive().max(8000), fps: z.number().finite().positive().max(120).optional() }).strict(),
  'video-compressor': z.object({ videoBitsPerSecond: z.number().int().positive().max(50_000_000).optional(), audioBitsPerSecond: z.number().int().positive().max(512_000).optional() }).strict(),
};

const TOOL_INTENTS: Readonly<Record<string, readonly string[]>> = {
  'filter-mask': ['live filter', 'camera filter', 'live camera', 'filters', 'فلتر مباشر', 'فلاتر الكاميرا'],
  'image-compressor': ['compress', 'smaller', 'reduce size', 'file size', 'lighter', 'ضغط الصور', 'تصغير حجم الصورة'],
  'background-remover': ['remove background', 'transparent background', 'cut out background', 'background removal', 'إزالة الخلفية', 'خلفية شفافة'],
  'image-upscaler': ['upscale', 'sharper', 'higher quality', 'increase resolution', 'make it clearer', 'رفع الجودة', 'زيادة الدقة'],
  'image-converter': ['convert format', 'jpg to png', 'png to jpg', 'webp', 'change format', 'تحويل الصيغة', 'تحويل الصورة'],
  'image-ocr': ['ocr', 'extract text', 'text from image', 'read text', 'استخراج النص', 'قراءة النص'],
  'image-cropper': ['crop', 'resize', 'dimensions', 'aspect ratio', 'قص الصورة', 'تغيير الحجم'],
  'image-effects': ['brightness', 'contrast', 'saturation', 'grayscale', 'adjust image', 'سطوع', 'تباين', 'تشبع'],
  'image-to-svg': ['image to svg', 'raster to svg', 'convert image to svg', 'تحويل الصورة إلى svg', 'صورة إلى svg'],
  'background-blur': ['background blur', 'blur background', 'طمس الخلفية', 'ضبابية الخلفية'],
  'passport-photo-maker': ['passport photo', 'id photo', 'passport picture', 'صورة جواز سفر', 'صورة شخصية للهوية'],
  'watermark-adder': ['add watermark', 'watermark text', 'إضافة علامة مائية', 'إضافة علامة على الصورة'],
  'meme-generator': ['meme', 'meme generator', 'صورة ميم', 'ميم'],
  'collage-maker': ['collage', 'photo collage', 'image collage', 'كولاج', 'دمج الصور'],
  'exif-cleaner': ['remove exif', 'clean metadata', 'strip metadata', 'تنظيف البيانات الوصفية', 'إزالة exif'],
  'svg-optimizer': ['optimize svg', 'minify svg', 'ضغط svg', 'تحسين svg'],
  'mockup-generator': ['mockup', 'device mockup', 'نموذج عرض', 'موكاب'],
  'seed': ['seed editor', 'gpu adjustments', 'image adjustments', 'تعديلات الصورة', 'تحسينات gpu'],
  'pix': ['pix studio', 'photo editor', 'image editor', 'تحرير الصورة', 'محرر الصور'],
  'watermark-remover': ['remove watermark', 'erase watermark', 'إزالة العلامة المائية'],
  'object-remover': ['remove object', 'erase object', 'delete object', 'إزالة عنصر', 'حذف عنصر'],
  'ai-image-generator': ['generate image', 'create image with ai', 'text to image', 'make an image', 'إنشاء صورة بالذكاء الاصطناعي'],
  'image-rotate': ['rotate image','turn image','تدوير الصورة'],
  'image-flip-horizontal': ['flip horizontal','mirror image','قلب أفقي','عكس أفقي'],
  'image-flip-vertical': ['flip vertical','قلب رأسي','عكس رأسي'],
  'image-brightness': ['brightness','brighten image','سطوع الصورة','تفتيح الصورة'],
  'image-contrast': ['contrast','increase contrast','تباين الصورة'],
  'image-saturation': ['saturation','increase saturation','تشبع الصورة'],
  'image-grayscale': ['grayscale','black and white','أبيض وأسود','تدرج رمادي'],
  'image-invert': ['invert colors','negative image','عكس الألوان'],
  'image-sepia': ['sepia','sepia effect','تأثير سيبيا'],
  'image-blur': ['blur image','soften image','تمويه الصورة','ضبابية الصورة'],
  'image-sharpen': ['sharpen image','make image sharper','زيادة حدة الصورة'],
  'image-resizer': ['resize image','change image dimensions','تغيير حجم الصورة','تغيير أبعاد الصورة'],
  'image-hue': ['change hue','hue shift','تغيير درجة اللون','إزاحة اللون'],
  'image-pixelate': ['pixelate image','pixelation','بكسلة الصورة','تحويل الصورة لبكسلات'],
  'image-padding': ['add padding','image padding','إضافة هوامش للصورة','إضافة حواف للصورة'],
  'image-rounded-corners': ['rounded corners','round image corners','زوايا مستديرة','تدوير زوايا الصورة'],
  'video-trimmer': ['trim video', 'cut video', 'video trim', 'قص الفيديو', 'اقتطاع الفيديو'],
  'video-cropper': ['crop video', 'video crop', 'قص الفيديو من الاطراف', 'قص الفيديو من الأطراف'],
  'video-resizer': ['resize video', 'change video resolution', 'video dimensions', 'تغيير حجم الفيديو', 'تغيير دقة الفيديو'],
  'video-compressor': ['compress video', 'reduce video size', 'video compression', 'ضغط الفيديو', 'تصغير حجم الفيديو'],
};

export const MVP_EXECUTABLE_TOOL_IDS = CANONICAL_MVP_IDS;
const EXECUTABLE_IDS: ReadonlySet<string> = new Set(MVP_EXECUTABLE_TOOL_IDS);
const defaultVerifier: CapabilityVerifier = async (_inputBlob, outputBlob, _parameters, signal) => !signal?.aborted && outputBlob.size > 0;
const targetSizeVerifier: CapabilityVerifier = async (_inputBlob, outputBlob, parameters, signal) => {
  if (signal?.aborted || outputBlob.size <= 0) return false;
  const targetSizeKB = typeof parameters.targetSizeKB === 'number' ? parameters.targetSizeKB : undefined;
  return targetSizeKB === undefined ? true : outputBlob.size <= targetSizeKB * 1024;
};
const formatVerifier: CapabilityVerifier = async (_inputBlob, outputBlob, parameters, signal) => {
  const format = parameters.format;
  return !signal?.aborted && outputBlob.size > 0 && (typeof format !== 'string' || outputBlob.type === format);
};
const verifierFor = (toolId: string): CapabilityVerifier => {
  if (toolId === 'image-compressor') return targetSizeVerifier;
  if (toolId === 'image-converter') return formatVerifier;
  if (toolId.startsWith('video-')) return async (_inputBlob, outputBlob, _parameters, signal) => {
    if (signal?.aborted || outputBlob.size <= 0 || outputBlob.type !== 'video/webm' || typeof document === 'undefined') return false;
    const url = URL.createObjectURL(outputBlob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Video output metadata could not be decoded.'));
      });
      return Number.isFinite(video.duration) && video.duration > 0 && video.videoWidth > 0 && video.videoHeight > 0;
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    }
  };
  return defaultVerifier;
};

const executionFor = (mode: ExecutionMode): ToolExecution => {
  if (mode === 'LOCAL') return 'browser-local';
  if (mode === 'HYBRID') return 'browser-worker';
  return 'remote';
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
  const canonicalCapability = getCanonicalCapabilityDefinition(tool.id) as CanonicalCapabilityDefinition | undefined;
  const capabilityState = canonicalCapability?.state ?? stateFor(tool);
  const executionMode: ExecutionMode = canonicalCapability?.executionMode ?? (tool.id === 'ai-image-generator' || tool.id === 'photo-colorizer' ? 'CLOUD' : 'LOCAL');
  const parameterSchema = canonicalCapability?.parameterSchema ?? PARAMETER_SCHEMAS[tool.id] ?? COMMON_PARAMETERS;
  const safetyLimits = canonicalCapability?.safetyLimits ?? Object.freeze(tool.id.startsWith('video-')
    ? { maxPixels: 64_000_000, maxFileSizeBytes: 512 * 1024 * 1024, timeoutMs: 10 * 60 * 1000 }
    : { maxPixels: DEFAULT_MAX_PIXELS, maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES, timeoutMs: DEFAULT_TIMEOUT_MS });
  const verifier = canonicalCapability?.verifier ?? verifierFor(tool.id);
  const intents = Object.freeze(canonicalCapability?.intents ?? TOOL_INTENTS[tool.id] ?? []);
  const operational: ToolOperationalProfile = canonicalCapability?.operational ?? Object.freeze({
    lifecycle: tool.isReady ? 'ready' : 'experimental',
    execution: executionFor(executionMode),
    contracts: Object.freeze(['structural', 'runtime', 'artifact'] as const),
    executorId: capabilityState === 'EXECUTABLE' ? tool.id : null,
    outputContractId: tool.isReady ? tool.id : null,
  });
  const requirements: ToolRequirements = canonicalCapability?.requirements ?? Object.freeze({ browser: true, network: executionMode === 'CLOUD' });
  const recovery: ToolRecoveryPolicy = canonicalCapability?.recovery ?? Object.freeze({ maxAttempts: capabilityState === 'EXECUTABLE' ? 3 : 0, replanOnFailure: false });
  return Object.freeze({
    id: tool.id,
    family: tool.family ?? 'image',
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
    requirements,
    recovery,
    operational,
    localization: Object.freeze({ titleKey: `tool.${tool.id}.title`, descriptionKey: `tool.${tool.id}.description` }),
    seo: Object.freeze({ title: `${tool.title} | FLIXO`, description: tool.description, robots: 'index,follow,max-image-preview:large' as const }),
  });
}


export const TOOL_DEFINITIONS: readonly ToolDefinition[] = Object.freeze(IMAGE_TOOL_CONFIGS.map(toToolDefinition));

const byId = new Map(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));
export function getToolDefinition(id: string): ToolDefinition | undefined { return byId.get(id); }