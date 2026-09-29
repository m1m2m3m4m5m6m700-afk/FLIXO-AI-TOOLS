import { compressImage } from '../../tools/image-compressor/engine';
import { convertImage, cropResizeImage, imageInfo, removeBackground, resizeImage } from '../../tools/image-toolkit/engine';
import type { CapabilityParameters } from '../agent/capability-registry';
import { getVideoToolExecutor } from '../video/video-tool-executors';

export type ExecutableToolView = Readonly<{
  id: string;
  operational: Readonly<{ executorId: string | null }>;
  safetyLimits: Readonly<{
    maxPixels: number;
    maxFileSizeBytes: number;
    timeoutMs: number;
  }>;
}>;

type ExecutorCoverageTool = Readonly<{
  id: string;
  capability: Readonly<{ state: string }>;
  operational: Readonly<{ executorId: string | null }>;
}>;

export type ToolExecutorContext = Readonly<{
  tool: ExecutableToolView;
  inputBlob: Blob;
  parameters: CapabilityParameters;
  signal?: AbortSignal;
}>;

export type ToolExecutor = (context: ToolExecutorContext) => Promise<Blob>;
export type ToolParameterRepairer = (parameters: CapabilityParameters, attempt: number) => CapabilityParameters | null;

const asFile = (blob: Blob) => new File([blob], 'flixo-pipeline-input.png', { type: blob.type || 'image/png' });

async function effects(blob: Blob, params: CapabilityParameters, signal?: AbortSignal): Promise<Blob> {
  if (typeof Worker === 'undefined') throw new Error('Image Effects Worker is unavailable.');
  if (signal?.aborted) throw new DOMException('Execution aborted.', 'AbortError');

  const info = await imageInfo(blob);
  const values = [
    Number(params.brightness ?? 100),
    Number(params.contrast ?? 100),
    Number(params.saturate ?? 100),
    Number(params.grayscale ?? 0),
  ];
  if (!values.every(Number.isFinite)) throw new Error('Image effect parameters must be finite numbers.');

  return await new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(
      new URL('../../tools/_shared/image-effects-worker.ts', import.meta.url),
      { type: 'classic' },
    );
    let settled = false;
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', onAbort);
    };
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => finishError(new DOMException('Execution aborted.', 'AbortError'));

    signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<{ ok: boolean; blob?: Blob; error?: string }>) => {
      if (event.data.ok && event.data.blob instanceof Blob && event.data.blob.size > 0) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(event.data.blob);
        return;
      }
      finishError(new Error(event.data.error || 'Image Effects Worker failed.'));
    };
    worker.onerror = () => finishError(new Error('Image Effects Worker could not start.'));
    worker.postMessage({ blob, width: info.width, height: info.height, ...Object.fromEntries([
      ['brightness', values[0]],
      ['contrast', values[1]],
      ['saturate', values[2]],
      ['grayscale', values[3]],
    ]) });
  });
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
  'image-effects': async ({ inputBlob, parameters, signal }) => effects(inputBlob, parameters, signal),
  'video-trimmer': async ({ inputBlob, parameters, tool, signal }) => {
    const executor = getVideoToolExecutor(tool);
    if (!executor) throw new Error('Video executor unavailable: video-trimmer');
    return executor(inputBlob, parameters, tool, signal);
  },
  'video-cropper': async ({ inputBlob, parameters, tool, signal }) => {
    const executor = getVideoToolExecutor(tool);
    if (!executor) throw new Error('Video executor unavailable: video-cropper');
    return executor(inputBlob, parameters, tool, signal);
  },
  'video-resizer': async ({ inputBlob, parameters, tool, signal }) => {
    const executor = getVideoToolExecutor(tool);
    if (!executor) throw new Error('Video executor unavailable: video-resizer');
    return executor(inputBlob, parameters, tool, signal);
  },
  'video-compressor': async ({ inputBlob, parameters, tool, signal }) => {
    const executor = getVideoToolExecutor(tool);
    if (!executor) throw new Error('Video executor unavailable: video-compressor');
    return executor(inputBlob, parameters, tool, signal);
  },
});

const REPAIRERS: Readonly<Record<string, ToolParameterRepairer>> = Object.freeze({
  'image-compressor': (parameters, attempt) => {
    const quality = typeof parameters.quality === 'number' ? parameters.quality : 0.82;
    const repairedQuality = Math.max(0.01, quality * Math.pow(0.72, attempt));
    return repairedQuality < quality ? { ...parameters, quality: repairedQuality } : null;
  },
});

export function getToolExecutor(tool: ExecutableToolView): ToolExecutor {
  const executorId = tool.operational.executorId;
  if (!executorId) throw new Error(`Tool '${tool.id}' has no executor binding.`);
  const executor = EXECUTORS[executorId];
  if (!executor) throw new Error(`No executor registered for adapter '${executorId}' (tool '${tool.id}').`);
  return executor;
}

export function repairToolParameters(tool: ExecutableToolView, parameters: CapabilityParameters, attempt: number): CapabilityParameters | null {
  const executorId = tool.operational.executorId;
  return executorId ? REPAIRERS[executorId]?.(parameters, attempt) ?? null : null;
}

export function assertExecutorCoverage(tools: readonly ExecutorCoverageTool[]): void {
  const executable = tools.filter((tool) => tool.capability.state === 'EXECUTABLE');
  const missingIds = executable.filter((tool) => !tool.operational.executorId).map((tool) => tool.id);
  const referencedIds = new Set(executable.map((tool) => tool.operational.executorId).filter((id): id is string => Boolean(id)));
  const missing = [...referencedIds].filter((executorId) => !EXECUTORS[executorId]);
  const orphan = Object.keys(EXECUTORS).filter((executorId) => !referencedIds.has(executorId));
  if (missingIds.length || missing.length || orphan.length) {
    throw new Error(`Executor coverage mismatch: missingIds=${missingIds.join(',')}; missing=${missing.join(',')}; orphan=${orphan.join(',')}`);
  }
}
