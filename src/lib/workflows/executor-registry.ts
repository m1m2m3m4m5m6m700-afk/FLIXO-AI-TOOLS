import { compressImage } from '@/tools/image-compressor/engine';
import { convertImage, cropResizeImage, imageInfo, removeBackground, resizeImage } from '@/tools/image-toolkit/engine';
import type { CapabilityParameters } from '@/lib/agent/capability-registry';
import type { ToolDefinition } from '@/config/canonical-tool-definition';

export type ToolExecutorContext = Readonly<{
  tool: ToolDefinition;
  inputBlob: Blob;
  parameters: CapabilityParameters;
}>;

export type ToolExecutor = (context: ToolExecutorContext) => Promise<Blob>;
export type ToolParameterRepairer = (parameters: CapabilityParameters, attempt: number) => CapabilityParameters | null;

const asFile = (blob: Blob) => new File([blob], 'flixo-pipeline-input.png', { type: blob.type || 'image/png' });

async function imageBitmap(blob: Blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.94) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), type, quality));
}

async function effects(blob: Blob, params: CapabilityParameters) {
  const image = await imageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  const values = [Number(params.brightness ?? 100), Number(params.contrast ?? 100), Number(params.saturate ?? 100), Number(params.grayscale ?? 0)];
  try {
    if (!values.every(Number.isFinite)) throw new Error('Image effect parameters must be finite numbers.');
    ctx.filter = `brightness(${values[0]}%) contrast(${values[1]}%) saturate(${values[2]}%) grayscale(${values[3]}%)`;
    ctx.drawImage(image, 0, 0);
    return canvasToBlob(canvas);
  } finally {
    if ('close' in image && typeof image.close === 'function') image.close();
  }
}

const EXECUTORS: Readonly<Record<string, ToolExecutor>> = Object.freeze({
  'background-remover': async ({ inputBlob, parameters }) => removeBackground(inputBlob, Number(parameters.tolerance ?? 42)),
  'image-upscaler': async ({ inputBlob, parameters, tool }) => {
    const info = await imageInfo(inputBlob);
    const scale = Number(parameters.scale ?? 2);
    const pixels = Math.round(info.width * scale) * Math.round(info.height * scale);
    if (!Number.isFinite(scale) || scale <= 0 || pixels > tool.safetyLimits.maxPixels) throw new Error('The requested upscale is too large for safe browser processing.');
    return resizeImage(inputBlob, scale);
  },
  'image-cropper': async ({ inputBlob, parameters, tool }) => {
    const info = await imageInfo(inputBlob);
    const [rw, rh] = String(parameters.aspectRatio ?? '1:1').split(':').map(Number);
    const targetRatio = rh > 0 ? rw / rh : 1;
    const sourceRatio = info.width / info.height;
    let cropWidth = info.width;
    let cropHeight = info.height;
    if (sourceRatio > targetRatio) cropWidth = Math.max(1, Math.round(info.height * targetRatio));
    else cropHeight = Math.max(1, Math.round(info.width / targetRatio));
    const x = Math.round((info.width - cropWidth) / 2);
    const y = Math.round((info.height - cropHeight) / 2);
    const outWidth = Number(parameters.width ?? cropWidth);
    const outHeight = Number(parameters.height ?? cropHeight);
    if (!Number.isFinite(outWidth) || !Number.isFinite(outHeight) || outWidth <= 0 || outHeight <= 0 || outWidth * outHeight > tool.safetyLimits.maxPixels) {
      throw new Error('The requested crop output is invalid or too large.');
    }
    return cropResizeImage(inputBlob, { x, y, width: cropWidth, height: cropHeight }, { width: outWidth, height: outHeight });
  },
  'image-compressor': async ({ inputBlob, parameters }) => (
    await compressImage(asFile(inputBlob), {
      quality: Number(parameters.quality ?? 0.82),
      format: String(parameters.format ?? 'image/webp') as 'image/webp' | 'image/jpeg' | 'image/png',
      targetSizeKB: Number(parameters.targetSizeKB ?? 0) || undefined,
    })
  ).blob,
  'image-converter': async ({ inputBlob, parameters }) => convertImage(inputBlob, String(parameters.format ?? 'image/webp') as 'image/webp' | 'image/jpeg' | 'image/png'),
  'image-effects': async ({ inputBlob, parameters }) => effects(inputBlob, parameters),
});

const REPAIRERS: Readonly<Record<string, ToolParameterRepairer>> = Object.freeze({
  'image-compressor': (parameters, attempt) => {
    const quality = typeof parameters.quality === 'number' ? parameters.quality : 0.82;
    const repairedQuality = Math.max(0.01, quality * Math.pow(0.72, attempt));
    return repairedQuality < quality ? { ...parameters, quality: repairedQuality } : null;
  },
});

export function getToolExecutor(tool: ToolDefinition): ToolExecutor {
  const executorId = tool.operational.executorId;
  if (!executorId) throw new Error(`Tool '${tool.id}' has no executor binding.`);
  const executor = EXECUTORS[executorId];
  if (!executor) throw new Error(`No executor registered for adapter '${executorId}' (tool '${tool.id}').`);
  return executor;
}

export function repairToolParameters(tool: ToolDefinition, parameters: CapabilityParameters, attempt: number): CapabilityParameters | null {
  const executorId = tool.operational.executorId;
  return executorId ? REPAIRERS[executorId]?.(parameters, attempt) ?? null : null;
}

export function assertExecutorCoverage(tools: readonly ToolDefinition[]): void {
  const executableTools = tools.filter((tool) => tool.capability.state === 'EXECUTABLE');
  const executableBindings = executableTools
    .map((tool) => tool.operational.executorId)
    .filter((executorId): executorId is string => Boolean(executorId));
  const missing = executableTools
    .filter((tool) => !tool.operational.executorId || !EXECUTORS[tool.operational.executorId])
    .map((tool) => tool.id);
  const orphan = Object.keys(EXECUTORS).filter((executorId) => !executableBindings.includes(executorId));
  const invalidNonExecutable = tools
    .filter((tool) => tool.capability.state !== 'EXECUTABLE' && tool.operational.executorId !== null)
    .map((tool) => tool.id);

  if (missing.length || orphan.length || invalidNonExecutable.length) {
    const details = [
      missing.length ? `missing=${missing.join(',')}` : '',
      orphan.length ? `orphan=${orphan.join(',')}` : '',
      invalidNonExecutable.length ? `nonExecutableBound=${invalidNonExecutable.join(',')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`Executor registry coverage mismatch: ${details}`);
  }
}
