import { compressImage } from '@/tools/image-compressor/engine';
import { convertImage, cropResizeImage, imageInfo, removeBackground, resizeImage } from '@/tools/image-toolkit/engine';
import type { ExecutionPlan } from '@/lib/ai/planner';
import { EXECUTABLE_PIPELINE_TOOL_ID_SET, type ExecutablePipelineToolId } from '@/lib/workflows/executable-tools';
import { DisposableResourceOwner, throwIfAborted } from '@/lib/resources/disposable-resource-owner';

export interface PipelineProgress { currentStepIndex: number; totalSteps: number; currentToolId: string; outputBlob?: Blob; }
type PipelineParams = Record<string, string | number | boolean | undefined>;
const MAX_OUTPUT_PIXELS = 16_000_000;
const asFile = (blob: Blob) => new File([blob], 'flixo-pipeline-input.png', { type: blob.type || 'image/png' });

function isExecutablePipelineToolId(value: string): value is ExecutablePipelineToolId {
  return EXECUTABLE_PIPELINE_TOOL_ID_SET.has(value as ExecutablePipelineToolId);
}

async function imageBitmap(blob: Blob, owner: DisposableResourceOwner, signal: AbortSignal) {
  throwIfAborted(signal);
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    throwIfAborted(signal);
    return bitmap;
  }
  const url = owner.objectUrl('pipeline-image-source', blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    throwIfAborted(signal);
    return image;
  } finally {
    await owner.dispose('pipeline-image-source');
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.94) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), type, quality));
}

async function effects(blob: Blob, params: PipelineParams, owner: DisposableResourceOwner, signal: AbortSignal) {
  const image = await imageBitmap(blob, owner, signal);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  const values = [Number(params.brightness ?? 100), Number(params.contrast ?? 100), Number(params.saturate ?? 100), Number(params.grayscale ?? 0)];
  try {
    throwIfAborted(signal);
    if (!values.every(Number.isFinite)) throw new Error('Image effect parameters must be finite numbers.');
    ctx.filter = `brightness(${values[0]}%) contrast(${values[1]}%) saturate(${values[2]}%) grayscale(${values[3]}%)`;
    ctx.drawImage(image, 0, 0);
    throwIfAborted(signal);
    return await canvasToBlob(canvas);
  } finally {
    if ('close' in image && typeof image.close === 'function') image.close();
  }
}

async function processToolStep(toolId: ExecutablePipelineToolId, inputBlob: Blob, params: PipelineParams, owner: DisposableResourceOwner, signal: AbortSignal) {
  throwIfAborted(signal);
  switch (toolId) {
    case 'background-remover': return removeBackground(inputBlob, Number(params.tolerance ?? 42));
    case 'image-upscaler': {
      const info = await imageInfo(inputBlob);
      const scale = Number(params.scale ?? 2);
      if (!Number.isFinite(scale) || scale <= 0) throw new Error('Upscale scale must be positive.');
      const pixels = Math.round(info.width * scale) * Math.round(info.height * scale);
      if (pixels > MAX_OUTPUT_PIXELS) throw new Error('The requested upscale is too large for safe browser processing.');
      return resizeImage(inputBlob, scale);
    }
    case 'image-cropper': {
      const info = await imageInfo(inputBlob);
      const [rw, rh] = String(params.aspectRatio ?? '1:1').split(':').map(Number);
      const targetRatio = rh > 0 ? rw / rh : 1;
      const sourceRatio = info.width / info.height;
      let cropWidth = info.width;
      let cropHeight = info.height;
      if (sourceRatio > targetRatio) cropWidth = Math.max(1, Math.round(info.height * targetRatio)); else cropHeight = Math.max(1, Math.round(info.width / targetRatio));
      const x = Math.round((info.width - cropWidth) / 2);
      const y = Math.round((info.height - cropHeight) / 2);
      const outWidth = Number(params.width ?? cropWidth);
      const outHeight = Number(params.height ?? cropHeight);
      if (!Number.isFinite(outWidth) || !Number.isFinite(outHeight) || outWidth <= 0 || outHeight <= 0 || outWidth * outHeight > MAX_OUTPUT_PIXELS) throw new Error('The requested crop output is invalid or too large.');
      return cropResizeImage(inputBlob, { x, y, width: cropWidth, height: cropHeight }, { width: outWidth, height: outHeight });
    }
    case 'image-compressor': {
      const format = String(params.format ?? 'image/webp');
      if (format !== 'image/webp' && format !== 'image/jpeg' && format !== 'image/png') throw new Error('Unsupported pipeline image format.');
      return (await compressImage(asFile(inputBlob), { quality: Number(params.quality ?? 0.82), format, targetSizeKB: Number(params.targetSizeKB ?? 0) || undefined }, owner, signal)).blob;
    }
    case 'image-converter': {
      const format = String(params.format ?? 'image/webp');
      if (format !== 'image/webp' && format !== 'image/jpeg' && format !== 'image/png') throw new Error('Unsupported pipeline image format.');
      return convertImage(inputBlob, format);
    }
    case 'image-effects': return effects(inputBlob, params, owner, signal);
  }
}

export async function runWorkflowPipeline(initialFile: File, plan: ExecutionPlan, onProgress: (progress: PipelineProgress) => void, signal: AbortSignal): Promise<Blob> {
  if (plan.steps.length === 0 || plan.steps.length > 4) throw new Error('FLIXO plans must contain 1 to 4 steps.');
  const owner = new DisposableResourceOwner();
  let currentBlob: Blob = initialFile;
  try {
    for (let i = 0; i < plan.steps.length; i += 1) {
      throwIfAborted(signal);
      const step = plan.steps[i];
      if (!step || !isExecutablePipelineToolId(step.toolId)) throw new Error(`Tool '${step?.toolId ?? 'unknown'}' is not executable by the local pipeline.`);
      onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId });
      currentBlob = await processToolStep(step.toolId, currentBlob, step.params ?? {}, owner, signal);
      throwIfAborted(signal);
      onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, outputBlob: currentBlob });
    }
    return currentBlob;
  } finally {
    await owner.disposeAll();
  }
}
