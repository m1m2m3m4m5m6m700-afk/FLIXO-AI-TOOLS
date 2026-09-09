import { z, type ZodType } from 'zod';
import { IMAGE_TOOLS } from '@/config/tool-definitions/image';

export type CapabilityState = 'RECOGNIZED' | 'PLANNABLE' | 'EXECUTABLE' | 'UNAVAILABLE';
export type ExecutionMode = 'LOCAL' | 'HYBRID' | 'CLOUD';

export type CapabilityLimits = Readonly<{
  maxPixels: number;
  maxFileSizeBytes: number;
  timeoutMs: number;
}>;

export type CapabilityContract = Readonly<{
  id: string;
  state: CapabilityState;
  executionMode: ExecutionMode;
  intents: readonly string[];
  parameterSchema: ZodType;
  safetyLimits: CapabilityLimits;
  verifier: (inputBlob: Blob, outputBlob: Blob) => Promise<boolean>;
}>;

const DEFAULT_MAX_PIXELS = 16_000_000;
const DEFAULT_MAX_FILE_SIZE_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;

const COMMON_PARAMETERS = z.record(z.string().max(64), z.union([z.string(), z.number().finite(), z.boolean()]));
const PARAMETER_SCHEMAS: Readonly<Record<string, ZodType>> = {
  'background-remover': z.object({ tolerance: z.number().finite().min(0).max(255).optional() }).strict(),
  'image-upscaler': z.object({ scale: z.number().finite().positive().max(8).optional() }).strict(),
  'image-cropper': z.object({
    width: z.number().int().positive().max(4000).optional(),
    height: z.number().int().positive().max(4000).optional(),
    aspectRatio: z.string().regex(/^\d{1,3}:\d{1,3}$/).optional(),
    mode: z.literal('exact').optional(),
  }).strict(),
  'image-compressor': z.object({
    quality: z.number().finite().min(0.01).max(1).optional(),
    format: z.enum(MIME_TYPES).optional(),
    targetSizeKB: z.number().finite().int().positive().max(64 * 1024).optional(),
  }).strict(),
  'image-converter': z.object({ format: z.enum(MIME_TYPES) }).strict(),
  'image-effects': z.object({
    brightness: z.number().finite().min(0).max(200).optional(),
    contrast: z.number().finite().min(0).max(200).optional(),
    saturate: z.number().finite().min(0).max(200).optional(),
    grayscale: z.number().finite().min(0).max(100).optional(),
  }).strict(),
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

const EXECUTABLE_IDS = new Set([
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
]);

function executionModeFor(toolId: string): ExecutionMode {
  if (toolId === 'ai-image-generator' || toolId === 'photo-colorizer') return 'CLOUD';
  return 'LOCAL';
}

function stateFor(toolId: string, isReady: boolean): CapabilityState {
  if (!isReady) return 'UNAVAILABLE';
  if (EXECUTABLE_IDS.has(toolId)) return 'EXECUTABLE';
  if (toolId in TOOL_INTENTS) return 'PLANNABLE';
  return 'RECOGNIZED';
}

const defaultVerifier = async (_inputBlob: Blob, outputBlob: Blob): Promise<boolean> => outputBlob.size > 0;

const entries = IMAGE_TOOLS.map((tool) => ({
  id: tool.id,
  state: stateFor(tool.id, tool.isReady),
  executionMode: executionModeFor(tool.id),
  intents: TOOL_INTENTS[tool.id] ?? [],
  parameterSchema: PARAMETER_SCHEMAS[tool.id] ?? COMMON_PARAMETERS,
  safetyLimits: {
    maxPixels: DEFAULT_MAX_PIXELS,
    maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  verifier: defaultVerifier,
} satisfies CapabilityContract));

export const CAPABILITY_REGISTRY: readonly CapabilityContract[] = Object.freeze(entries);

const byId = new Map(CAPABILITY_REGISTRY.map((capability) => [capability.id, capability]));

export function getCapability(id: string): CapabilityContract | undefined {
  return byId.get(id);
}

export function getCapabilitiesByState(state: CapabilityState): readonly CapabilityContract[] {
  return CAPABILITY_REGISTRY.filter((capability) => capability.state === state);
}

export function getExecutableCapabilityIds(): readonly string[] {
  return CAPABILITY_REGISTRY.filter((capability) => capability.state === 'EXECUTABLE').map((capability) => capability.id);
}

export function validateCapabilityParameters(id: string, parameters: unknown = {}): Record<string, string | number | boolean> {
  const capability = getCapability(id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  if (capability.state !== 'EXECUTABLE') throw new Error(`Capability '${id}' is not executable.`);
  return capability.parameterSchema.parse(parameters) as Record<string, string | number | boolean>;
}

export function assertExecutionResourceBudget(id: string, inputBlob: Blob, requestedPixels?: number): void {
  const capability = getCapability(id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  if (capability.state !== 'EXECUTABLE') throw new Error(`Capability '${id}' is not executable.`);
  if (inputBlob.size > capability.safetyLimits.maxFileSizeBytes) {
    throw new Error(`Capability '${id}' input exceeds the safe file-size limit.`);
  }
  if (requestedPixels !== undefined && requestedPixels > capability.safetyLimits.maxPixels) {
    throw new Error(`Capability '${id}' request exceeds the safe pixel limit.`);
  }
}
