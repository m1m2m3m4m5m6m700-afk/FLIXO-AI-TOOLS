import { compressImage } from '@/tools/image-compressor/engine';
import { MAX_OUTPUT_PIXELS, convertImage, cropResizeImage, imageInfo, removeBackground, resizeImage } from '@/tools/image-toolkit/engine';
import type { ExecutionPlan } from '@/lib/ai/planner';
import { EXECUTABLE_PIPELINE_TOOL_ID_SET, type ExecutablePipelineToolId } from '@/lib/workflows/executable-tools';

export interface PipelineProgress { currentStepIndex: number; totalSteps: number; currentToolId: string; outputBlob?: Blob; }
type PipelineParams = Record<string, string | number | boolean | undefined>;
const asFile = (blob: Blob) => new File([blob], 'flixo-pipeline-input.png', { type: blob.type || 'image/png' });
async function imageBitmap(blob: Blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob); const image = new Image();
  try { image.src = url; await image.decode(); return image; } finally { URL.revokeObjectURL(url); }
}
function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.94) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), type, quality));
}
async function effects(blob: Blob, params?: PipelineParams) {
  const image = await imageBitmap(blob); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.');
  const values = [Number(params?.brightness ?? 100), Number(params?.contrast ?? 100), Number(params?.saturate ?? 100), Number(params?.grayscale ?? 0)];
  try { if (!values.every(Number.isFinite)) throw new Error('Image effect parameters must be finite numbers.'); ctx.filter = `brightness(${values[0]}%) contrast(${values[1]}%) saturate(${values[2]}%) grayscale(${values[3]}%)`; ctx.drawImage(image, 0, 0); return canvasToBlob(canvas); }
  finally { if ('close' in image && typeof image.close === 'function') image.close(); }
}
async function processToolStep(toolId: ExecutablePipelineToolId, inputBlob: Blob, params: PipelineParams = {}) {
  switch (toolId) {
    case 'background-remover': return removeBackground(inputBlob, Number(params.tolerance ?? 42));
    case 'image-upscaler': { const info = await imageInfo(inputBlob); const scale = Number(params.scale ?? 2); if (!Number.isFinite(scale) || scale <= 0) throw new Error('Upscale scale must be positive.'); const pixels = Math.round(info.width * scale) * Math.round(info.height * scale); if (pixels > MAX_OUTPUT_PIXELS) throw new Error('The requested upscale is too large for safe browser processing.'); return resizeImage(inputBlob, scale); }
    case 'image-cropper': { const info = await imageInfo(inputBlob); const [rw, rh] = String(params.aspectRatio ?? '1:1').split(':').map(Number); const targetRatio = rh > 0 ? rw / rh : 1; const sourceRatio = info.width / info.height; let cropWidth = info.width; let cropHeight = info.height; if (sourceRatio > targetRatio) cropWidth = Math.max(1, Math.round(info.height * targetRatio)); else cropHeight = Math.max(1, Math.round(info.width / targetRatio)); const x = Math.round((info.width - cropWidth) / 2); const y = Math.round((info.height - cropHeight) / 2); const outWidth = Number(params.width ?? cropWidth); const outHeight = Number(params.height ?? cropHeight); if (!Number.isFinite(outWidth) || !Number.isFinite(outHeight) || outWidth <= 0 || outHeight <= 0 || outWidth * outHeight > MAX_OUTPUT_PIXELS) throw new Error('The requested crop output is invalid or too large.'); return cropResizeImage(inputBlob, { x, y, width: cropWidth, height: cropHeight }, { width: outWidth, height: outHeight }); }
    case 'image-compressor': return (await compressImage(asFile(inputBlob), { quality: Number(params.quality ?? 0.82), format: String(params.format ?? 'image/webp') as 'image/webp' | 'image/jpeg' | 'image/png', targetSizeKB: Number(params.targetSizeKB ?? 0) || undefined })).blob;
    case 'image-converter': return convertImage(inputBlob, String(params.format ?? 'image/webp') as 'image/webp' | 'image/jpeg' | 'image/png');
    case 'image-effects': return effects(inputBlob, params);
    default: { const neverTool: never = toolId; throw new Error(`Unsupported pipeline tool: ${neverTool}`); }
  }
}
export async function runWorkflowPipeline(initialFile: File, plan: ExecutionPlan, onProgress: (progress: PipelineProgress) => void): Promise<Blob> {
  if (plan.steps.length === 0 || plan.steps.length > 4) throw new Error('FLIXO plans must contain 1 to 4 steps.');
  let currentBlob: Blob = initialFile;
  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    if (!EXECUTABLE_PIPELINE_TOOL_ID_SET.has(step.toolId)) throw new Error(`Tool '${step.toolId}' is not executable by the local pipeline.`);
    onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId });
    currentBlob = await processToolStep(step.toolId as ExecutablePipelineToolId, currentBlob, step.params);
    onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, outputBlob: currentBlob });
  }
  return currentBlob;
}
