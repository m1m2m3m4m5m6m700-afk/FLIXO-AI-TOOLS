import { assertSafeImageInput, IMAGE_COMPRESSOR_MAX_INPUT_SIZE, IMAGE_COMPRESSOR_MAX_PIXELS } from './file-safety';

export type CompressionFormat = 'image/jpeg' | 'image/webp' | 'image/png';

export type CompressionOptions = {
  quality: number;
  format: CompressionFormat;
  maxWidth?: number;
  maxHeight?: number;
  targetSizeKB?: number;
};

export type CompressionResult = {
  blob: Blob;
  width: number;
  height: number;
  mimeType: CompressionFormat;
  qualityUsed: number;
};

export const MAX_FILES = 20;
export const MAX_INPUT_SIZE = IMAGE_COMPRESSOR_MAX_INPUT_SIZE;
export const MAX_OUTPUT_PIXELS = IMAGE_COMPRESSOR_MAX_PIXELS;

const SUPPORTED_INPUTS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
]);

function getTargetSize(width: number, height: number, maxWidth?: number, maxHeight?: number) {
  const widthLimit = Number.isFinite(maxWidth) && (maxWidth ?? 0) > 0 ? maxWidth! : width;
  const heightLimit = Number.isFinite(maxHeight) && (maxHeight ?? 0) > 0 ? maxHeight! : height;
  const scale = Math.min(1, widthLimit / width, heightLimit / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function encode(canvas: HTMLCanvasElement, format: CompressionFormat, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image encoding failed'))),
      format,
      Math.min(1, Math.max(0.05, quality)),
    );
  });
}

async function encodeToTarget(
  canvas: HTMLCanvasElement,
  format: CompressionFormat,
  quality: number,
  targetBytes?: number,
) {
  if (!targetBytes || format === 'image/png') {
    return { blob: await encode(canvas, format, quality), qualityUsed: quality };
  }

  let low = 0.05;
  let high = Math.min(1, Math.max(0.05, quality));
  let bestBlob: Blob | null = null;
  let bestQuality = low;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const candidateQuality = (low + high) / 2;
    const candidate = await encode(canvas, format, candidateQuality);
    if (candidate.size <= targetBytes) {
      bestBlob = candidate;
      bestQuality = candidateQuality;
      low = candidateQuality;
      if (candidate.size >= targetBytes * 0.98) break;
    } else {
      high = candidateQuality;
    }
  }

  if (bestBlob) return { blob: bestBlob, qualityUsed: bestQuality };
  const fallback = await encode(canvas, format, 0.05);
  return { blob: fallback, qualityUsed: 0.05 };
}

type SourceImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

async function loadSourceImage(file: File): Promise<SourceImage> {
  if (file.type !== 'image/svg+xml' && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the HTMLImageElement path, which is more tolerant of browser decoders.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The source image could not be decoded.'));
      element.src = url;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error ? error : new Error('The source image could not be decoded.');
  }
}

async function compressImageOnMainThread(file: File, options: CompressionOptions): Promise<CompressionResult> {
  assertSafeImageInput(file);

  const image = await loadSourceImage(file);
  try {
    assertSafeImageInput(file, { width: image.width, height: image.height });

    const size = getTargetSize(image.width, image.height, options.maxWidth, options.maxHeight);
    if (size.width * size.height > MAX_OUTPUT_PIXELS) {
      throw new Error('The requested output is too large for safe browser processing. Reduce the dimensions and try again.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas is unavailable');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    if (options.format === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size.width, size.height);
    }
    context.drawImage(image.source, 0, 0, size.width, size.height);

    const targetBytes = options.targetSizeKB && options.targetSizeKB > 0 ? options.targetSizeKB * 1024 : undefined;
    const encoded = await encodeToTarget(canvas, options.format, options.quality, targetBytes);

    return {
      blob: encoded.blob,
      width: size.width,
      height: size.height,
      mimeType: options.format,
      qualityUsed: encoded.qualityUsed,
    };
  } finally {
    image.cleanup();
  }
}

type WorkerResponse =
  | { ok: true; result: CompressionResult }
  | { ok: false; error: string };

function canUseCompressionWorker(file: File) {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    file.type !== 'image/svg+xml'
  );
}

function compressImageInWorker(file: File, options: CompressionOptions): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./compressor.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('The compression worker failed.'));
    };

    worker.postMessage({ file, options });
  });
}

export async function compressImage(file: File, options: CompressionOptions): Promise<CompressionResult> {
  assertSafeImageInput(file);

  if (canUseCompressionWorker(file)) {
    try {
      return await compressImageInWorker(file, options);
    } catch {
      // Keep a safe main-thread fallback for browsers with partial worker/canvas support.
    }
  }

  return compressImageOnMainThread(file, options);
}
