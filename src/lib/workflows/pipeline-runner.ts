import { compressImage } from '@/tools/image-compressor/engine';
import { convertImage, cropResizeImage, imageInfo, removeBackground, resizeImage } from '@/tools/image-toolkit/engine';
import type { ExecutionPlan } from '@/lib/ai/planner';
import { assertExecutionResourceBudget, getCapability, validateCapabilityParameters, type CapabilityParameters } from '@/lib/agent/capability-registry';
import { EXECUTABLE_PIPELINE_TOOL_ID_SET, type ExecutablePipelineToolId } from '@/lib/workflows/executable-tools';

export interface PipelineProgress { currentStepIndex: number; totalSteps: number; currentToolId: string; outputBlob?: Blob; retry?: number; }
export class PipelineVerificationError extends Error {
  constructor(message: string, readonly stableBlob: Blob, readonly failedStepIndex: number, readonly failedToolId: string) { super(message); this.name = 'PipelineVerificationError'; }
}
type PipelineParams = CapabilityParameters;
const MAX_OUTPUT_PIXELS = 16_000_000;
const MAX_RETRIES = 2;
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
  const capability = getCapability(toolId);
  if (!capability || capability.state !== 'EXECUTABLE') throw new Error(`Capability '${toolId}' is not executable.`);
  const validatedParams = validateCapabilityParameters(toolId, params);
  assertExecutionResourceBudget(toolId, inputBlob);
  switch (toolId) {
    case 'background-remover': return removeBackground(inputBlob, Number(validatedParams.tolerance ?? 42));
    case 'image-upscaler': { const info = await imageInfo(inputBlob); const scale = Number(validatedParams.scale ?? 2); const pixels = Math.round(info.width * scale) * Math.round(info.height * scale); if (!Number.isFinite(scale) || scale <= 0 || pixels > capability.safetyLimits.maxPixels || pixels > MAX_OUTPUT_PIXELS) throw new Error('The requested upscale is too large for safe browser processing.'); return resizeImage(inputBlob, scale); }
    case 'image-cropper': { const info = await imageInfo(inputBlob); const [rw, rh] = String(validatedParams.aspectRatio ?? '1:1').split(':').map(Number); const targetRatio = rh > 0 ? rw / rh : 1; const sourceRatio = info.width / info.height; let cropWidth = info.width; let cropHeight = info.height; if (sourceRatio > targetRatio) cropWidth = Math.max(1, Math.round(info.height * targetRatio)); else cropHeight = Math.max(1, Math.round(info.width / targetRatio)); const x = Math.round((info.width - cropWidth) / 2); const y = Math.round((info.height - cropHeight) / 2); const outWidth = Number(validatedParams.width ?? cropWidth); const outHeight = Number(validatedParams.height ?? cropHeight); if (!Number.isFinite(outWidth) || !Number.isFinite(outHeight) || outWidth <= 0 || outHeight <= 0 || outWidth * outHeight > capability.safetyLimits.maxPixels || outWidth * outHeight > MAX_OUTPUT_PIXELS) throw new Error('The requested crop output is invalid or too large.'); return cropResizeImage(inputBlob, { x, y, width: cropWidth, height: cropHeight }, { width: outWidth, height: outHeight }); }
    case 'image-compressor': return (await compressImage(asFile(inputBlob), { quality: Number(validatedParams.quality ?? 0.82), format: String(validatedParams.format ?? 'image/webp') as 'image/webp' | 'image/jpeg' | 'image/png', targetSizeKB: Number(validatedParams.targetSizeKB ?? 0) || undefined })).blob;
    case 'image-converter': return convertImage(inputBlob, String(validatedParams.format ?? 'image/webp') as 'image/webp' | 'image/jpeg' | 'image/png');
    case 'image-effects': return effects(inputBlob, validatedParams);
    default: { const neverTool: never = toolId; throw new Error(`Unsupported pipeline tool: ${neverTool}`); }
  }
}

function repairParameters(toolId: ExecutablePipelineToolId, params: PipelineParams, attempt: number): PipelineParams | null {
  if (toolId !== 'image-compressor') return null;
  const quality = typeof params.quality === 'number' ? params.quality : 0.82;
  const repairedQuality = Math.max(0.01, quality * Math.pow(0.72, attempt));
  if (repairedQuality >= quality) return null;
  return { ...params, quality: repairedQuality };
}

async function verifyOutput(toolId: ExecutablePipelineToolId, inputBlob: Blob, outputBlob: Blob, params: PipelineParams): Promise<boolean> {
  const capability = getCapability(toolId);
  if (!capability) return false;
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), capability.safetyLimits.timeoutMs));
  return Promise.race([capability.verifier(inputBlob, outputBlob, params), timeout]);
}

export async function runWorkflowPipeline(initialFile: File, plan: ExecutionPlan, onProgress: (progress: PipelineProgress) => void): Promise<Blob> {
  if (plan.steps.length === 0 || plan.steps.length > 4) throw new Error('FLIXO plans must contain 1 to 4 steps.');
  let currentBlob: Blob = initialFile;
  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    if (!EXECUTABLE_PIPELINE_TOOL_ID_SET.has(step.toolId)) throw new Error(`Tool '${step.toolId}' is not executable by the local pipeline.`);
    const stableBlob = currentBlob;
    let params: PipelineParams = validateCapabilityParameters(step.toolId, step.params ?? {});
    let verified = false;
    let lastOutput: Blob | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, retry: attempt });
      try {
        const output = await processToolStep(step.toolId as ExecutablePipelineToolId, stableBlob, params);
        lastOutput = output;
        verified = await verifyOutput(step.toolId as ExecutablePipelineToolId, stableBlob, output, params);
        if (verified) {
          currentBlob = output;
          onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, outputBlob: output, retry: attempt });
          break;
        }
      } catch (error) {
        if (attempt === MAX_RETRIES) throw new PipelineVerificationError(error instanceof Error ? error.message : `Step '${step.toolId}' failed.`, stableBlob, i, step.toolId);
      }
      if (!verified && attempt < MAX_RETRIES) {
        const repaired = repairParameters(step.toolId as ExecutablePipelineToolId, params, attempt + 1);
        if (repaired) params = validateCapabilityParameters(step.toolId, repaired);
        else if (lastOutput === null) throw new PipelineVerificationError(`Verification failed for '${step.toolId}'.`, stableBlob, i, step.toolId);
      }
    }
    if (!verified) throw new PipelineVerificationError(`Verification failed for '${step.toolId}'.`, stableBlob, i, step.toolId);
  }
  return currentBlob;
}
