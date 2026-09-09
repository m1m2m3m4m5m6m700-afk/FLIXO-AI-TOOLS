import { getCapability, validateCapabilityParameters, type CapabilityState } from '@/lib/agent/capability-registry';

export type ExtractedOperation = {
  capability: string;
  params: Record<string, string | number | boolean>;
};

export type StructuredIntentPayload = Readonly<{
  operations: readonly ExtractedOperation[];
  unrecognizedFragments: readonly string[];
}>;

export type ExtractionResult = Readonly<{
  success: boolean;
  payload?: StructuredIntentPayload;
  errors: readonly string[];
}>;

const EXECUTABLE_STATES: readonly CapabilityState[] = ['EXECUTABLE'];
const MIME_BY_FORMAT = Object.freeze({
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
});

const normalizeText = (input: string): string => input
  .toLocaleLowerCase()
  .replace(/\u00a0/g, ' ')
  .replace(/[،،]/g, ',')
  .replace(/\s+/g, ' ')
  .trim();

function addOperation(operations: ExtractedOperation[], capabilityId: string, params: Record<string, string | number | boolean>): void {
  const capability = getCapability(capabilityId);
  if (!capability || !EXECUTABLE_STATES.includes(capability.state)) return;
  const previous = operations.find((operation) => operation.capability === capabilityId);
  if (previous) previous.params = { ...previous.params, ...params };
  else operations.push({ capability: capabilityId, params });
}

function parseTargetSize(text: string): number | undefined {
  const match = text.match(/(?:under|below|less than|maximum|max|at most|أقل من|اقل من|تحت|بحد أقصى|حد أقصى)\s*(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|كيلوبايت|ميجابايت)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  const unit = match[2].toLocaleLowerCase();
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return unit === 'mb' || unit === 'mib' || unit === 'ميجابايت' ? Math.round(value * 1024) : Math.round(value);
}

function parseFormat(text: string): string | undefined {
  const match = text.match(/(?:to|as|format(?: to)?|تحويل(?: لـ| إلى| الى)?|صيغة(?: إلى| الى)?)\s*(webp|png|jpe?g)\b/i) ?? text.match(/\b(webp|png|jpe?g)\b/i);
  if (!match) return undefined;
  return MIME_BY_FORMAT[match[1].toLocaleLowerCase() as keyof typeof MIME_BY_FORMAT];
}

function parseDimensions(text: string): { width: number; height: number } | undefined {
  const match = text.match(/(?:resize|dimensions?|size|أبعاد|حجم|غيّر الحجم|غير الحجم)\s*(?:to|إلى|الى|لـ)?\s*(\d{1,5})\s*[x×]\s*(\d{1,5})/i);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return undefined;
  return { width, height };
}

function parseAspectRatio(text: string): string | undefined {
  const match = text.match(/(?:aspect\s+ratio|ratio|نسبة\s*(?:الأبعاد|ابعاد)?)\s*(?:is|of|=|هي|:)?\s*(\d{1,3})\s*[:/]\s*(\d{1,3})/i);
  if (!match) return undefined;
  const left = Number(match[1]);
  const right = Number(match[2]);
  if (!Number.isInteger(left) || !Number.isInteger(right) || left <= 0 || right <= 0) return undefined;
  return `${left}:${right}`;
}

function parseBrightness(text: string): number | undefined {
  const match = text.match(/(?:increase|raise|boost|decrease|lower|خفض|ارفع|زيادة|تقليل|زِد|رفع)\s+(?:the\s+)?(?:brightness|سطوع)\s*(?:by|to|بـ|بمقدار|إلى|الى)?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount > 100) return undefined;
  return /(?:decrease|lower|خفض|تقليل)/i.test(match[0]) ? Math.max(0, 100 - amount) : Math.min(200, 100 + amount);
}

function validateOperation(operation: ExtractedOperation, errors: string[]): void {
  const capability = getCapability(operation.capability);
  if (!capability) {
    errors.push(`Unknown capability '${operation.capability}'.`);
    return;
  }
  if (!EXECUTABLE_STATES.includes(capability.state)) {
    errors.push(`Capability '${operation.capability}' is not executable.`);
    return;
  }
  try {
    operation.params = validateCapabilityParameters(operation.capability, operation.params);
    if (operation.capability === 'image-cropper') {
      const width = typeof operation.params.width === 'number' ? operation.params.width : undefined;
      const height = typeof operation.params.height === 'number' ? operation.params.height : undefined;
      if (width !== undefined && height !== undefined && width * height > capability.safetyLimits.maxPixels) {
        errors.push(`Capability '${operation.capability}' request exceeds the safe pixel limit.`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `Invalid parameters for '${operation.capability}'.`);
  }
}

export function extractParameters(input: string): ExtractionResult {
  if (typeof input !== 'string' || input.trim().length === 0) return { success: false, errors: ['Input text is empty.'], payload: { operations: [], unrecognizedFragments: [] } };

  const text = normalizeText(input);
  const operations: ExtractedOperation[] = [];
  const errors: string[] = [];
  const unrecognizedFragments: string[] = [];
  const targetSizeKB = parseTargetSize(text);
  const format = parseFormat(text);
  const dimensions = parseDimensions(text);
  const aspectRatio = parseAspectRatio(text);
  const brightness = parseBrightness(text);
  const hasCompressionIntent = /(?:compress|compression|ضغط|تصغير)/i.test(text);
  const hasConversionIntent = /(?:convert|conversion|تحويل|حول|حوّل)/i.test(text);

  if (hasCompressionIntent) addOperation(operations, 'image-compressor', targetSizeKB === undefined ? {} : { targetSizeKB });
  else if (targetSizeKB !== undefined) addOperation(operations, 'image-compressor', { targetSizeKB });

  if (hasConversionIntent && format !== undefined) addOperation(operations, 'image-converter', { format });
  if (format !== undefined && !hasCompressionIntent && !hasConversionIntent) addOperation(operations, 'image-converter', { format });
  if (dimensions) addOperation(operations, 'image-cropper', { width: dimensions.width, height: dimensions.height, mode: 'exact' });
  if (aspectRatio) addOperation(operations, 'image-cropper', { aspectRatio });
  if (brightness !== undefined) addOperation(operations, 'image-effects', { brightness });

  if (hasCompressionIntent && targetSizeKB === undefined) addOperation(operations, 'image-compressor', {});
  if (hasConversionIntent && format === undefined) errors.push('A target output format is required for image conversion.');
  if (/\b(?:crop|قص)\b/i.test(text) && dimensions === undefined && aspectRatio === undefined) errors.push('Crop requests require explicit dimensions or an aspect ratio.');

  for (const operation of operations) validateOperation(operation, errors);

  const knownSignal = /(?:compress|ضغط|convert|تحويل|حول|حوّل|webp|png|jpe?g|resize|dimensions|size|أبعاد|حجم|aspect\s+ratio|نسبة|brightness|سطوع|\d+\s*[x×]\s*\d+|\d+(?:\.\d+)?\s*(?:kb|kib|mb|mib|كيلوبايت|ميجابايت))/i;
  if (!knownSignal.test(text)) unrecognizedFragments.push(input.trim());
  if (operations.length === 0 && errors.length === 0) errors.push('No executable operation could be safely extracted.');
  if (unrecognizedFragments.length > 0) errors.push('Unrecognized instruction content requires explicit handling before execution.');

  if (errors.length > 0) return { success: false, errors, payload: { operations: [], unrecognizedFragments } };
  return { success: true, errors: [], payload: { operations, unrecognizedFragments };
}
