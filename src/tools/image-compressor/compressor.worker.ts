import { assertSafeImageInput, IMAGE_COMPRESSOR_MAX_PIXELS } from './file-safety';

type WorkerCompressionFormat = 'image/jpeg' | 'image/webp' | 'image/png';

type WorkerCompressionOptions = {
  quality: number;
  format: WorkerCompressionFormat;
  maxWidth?: number;
  maxHeight?: number;
  targetSizeKB?: number;
};

const MAX_OUTPUT_PIXELS = IMAGE_COMPRESSOR_MAX_PIXELS;

function getTargetSize(width: number, height: number, maxWidth?: number, maxHeight?: number) {
  const widthLimit = Number.isFinite(maxWidth) && (maxWidth ?? 0) > 0 ? maxWidth! : width;
  const heightLimit = Number.isFinite(maxHeight) && (maxHeight ?? 0) > 0 ? maxHeight! : height;
  const scale = Math.min(1, widthLimit / width, heightLimit / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function encode(canvas: OffscreenCanvas, format: WorkerCompressionFormat, quality: number) {
  const blob = await canvas.convertToBlob({ type: format, quality: Math.min(1, Math.max(0.05, quality)) });
  if (!blob) throw new Error('Image encoding failed');
  return blob;
}

async function encodeToTarget(canvas: OffscreenCanvas, format: WorkerCompressionFormat, quality: number, targetBytes?: number) {
  if (!targetBytes || format === 'image/png') return { blob: await encode(canvas, format, quality), qualityUsed: quality };

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
  return { blob: await encode(canvas, format, 0.05), qualityUsed: 0.05 };
}

self.onmessage = async (event: MessageEvent<{ file: File; options: WorkerCompressionOptions }>) => {
  try {
    const { file, options } = event.data;
    assertSafeImageInput(file);
    if (file.type === 'image/svg+xml') throw new Error('SVG worker path unavailable');

    const bitmap = await createImageBitmap(file);
    try {
      assertSafeImageInput(file, { width: bitmap.width, height: bitmap.height });
      const size = getTargetSize(bitmap.width, bitmap.height, options.maxWidth, options.maxHeight);
      if (size.width * size.height > MAX_OUTPUT_PIXELS) throw new Error('The requested output is too large for safe browser processing. Reduce the dimensions and try again.');

      const canvas = new OffscreenCanvas(size.width, size.height);
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('OffscreenCanvas is unavailable');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      if (options.format === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size.width, size.height);
      }
      context.drawImage(bitmap, 0, 0, size.width, size.height);

      const targetBytes = options.targetSizeKB && options.targetSizeKB > 0 ? options.targetSizeKB * 1024 : undefined;
      const encoded = await encodeToTarget(canvas, options.format, options.quality, targetBytes);
      self.postMessage({ ok: true, result: { blob: encoded.blob, width: size.width, height: size.height, mimeType: options.format, qualityUsed: encoded.qualityUsed } });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Compression failed' });
  }
};
