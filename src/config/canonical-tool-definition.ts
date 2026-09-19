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
  'image-compressor': z.object({ quality: z.number().finite().min(0.01).max(1).optional(), format: z.enum(MIME_TYPES).optional(), targetSizeKB: z.number().finite().int().positive().max(64 * 1024).optional(), maxWidth: z.number().int().positive().max(4000).optional(), maxHeight: z.number().int().positive().max(4000).optional() }).strict(),
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