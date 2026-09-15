import type { ChangeEvent } from 'react';

export type LocalToolId =
  | 'background-remover'
  | 'ai-image-generator'
  | 'image-upscaler'
  | 'image-converter'
  | 'image-to-text'
  | 'object-remover'
  | 'crop-resize'
  | 'watermark-remover'
  | 'raster-to-svg';

export type ImageInfo = { width: number; height: number };

async function decodeImage(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode === 'function') await image.decode();
}

export function imageInfo(blob: Blob): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    image.onload = () => {
      void decodeImage(image).then(() => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        cleanup();
        if (width <= 0 || height <= 0) {
          reject(new Error('Image decoded with invalid dimensions.'));
          return;
        }
        resolve({ width, height });
      }).catch((error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Image could not be decoded.'));
    };
    image.src = url;
  });
}

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    image.onload = () => {
      void decodeImage(image).then(() => {
        cleanup();
        resolve(image);
      }).catch((error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Image could not be decoded.'));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.96): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create output image.')), type, quality));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function sharpenCanvas(ctx: CanvasRenderingContext2D, amount = 0.11) {
  const { canvas } = ctx;
  if (canvas.width < 3 || canvas.height < 3) return;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new Uint8ClampedArray(pixels.data);
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const center = getPixel(source, canvas.width, x, y);
      const left = getPixel(source, canvas.width, x - 1, y);
      const right = getPixel(source, canvas.width, x + 1, y);
      const top = getPixel(source, canvas.width, x, y - 1);
      const bottom = getPixel(source, canvas.width, x, y + 1);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels.data[i + channel] = clamp(center[channel] + amount * (4 * center[channel] - left[channel] - right[channel] - top[channel] - bottom[channel]), 0, 255);
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

function progressiveResize(image: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  let source: CanvasImageSource = image;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  while (sourceWidth * 2 < width || sourceHeight * 2 < height) {
    const nextWidth = Math.min(width, Math.round(sourceWidth * 1.8));
    const nextHeight = Math.min(height, Math.round(sourceHeight * 1.8));
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextWidth;
    stepCanvas.height = nextHeight;
    const stepContext = stepCanvas.getContext('2d');
    if (!stepContext) throw new Error('Canvas is unavailable.');
    stepContext.imageSmoothingEnabled = true;
    stepContext.imageSmoothingQuality = 'high';
    stepContext.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, nextWidth, nextHeight);
    source = stepCanvas;
    sourceWidth = nextWidth;
    sourceHeight = nextHeight;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return canvas;
}

export async function resizeImage(blob: Blob, scale: number): Promise<Blob> {
  const image = await loadImage(blob);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = progressiveResize(image, width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  sharpenCanvas(ctx, scale > 1 ? 0.10 : 0.06);
  return canvasBlob(canvas, 'image/png');
}

export async function convertImage(blob: Blob, type: 'image/png' | 'image/jpeg' | 'image/webp'): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0);
  const quality = type === 'image/png' ? 1 : 0.96;
  return canvasBlob(canvas, type, quality);
}

export async function cropResizeImage(blob: Blob, crop: { x: number; y: number; width: number; height: number }, out: { width: number; height: number }): Promise<Blob> {
  const image = await loadImage(blob);
  const sourceX = clamp(Math.round(crop.x), 0, Math.max(0, image.naturalWidth - 1));
  const sourceY = clamp(Math.round(crop.y), 0, Math.max(0, image.naturalHeight - 1));
  const sourceWidth = clamp(Math.round(crop.width), 1, image.naturalWidth - sourceX);
  const sourceHeight = clamp(Math.round(crop.height), 1, image.naturalHeight - sourceY);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(out.width));
  canvas.height = Math.max(1, Math.round(out.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas, 'image/png');
}
