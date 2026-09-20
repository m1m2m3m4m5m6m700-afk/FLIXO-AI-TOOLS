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

export function imageInfo(blob: Blob): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image could not be decoded.'));
    };
    image.src = url;
  });
}

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
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

export async function removeBackground(blob: Blob, tolerance = 42): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const corners = [getPixel(data, canvas.width, 0, 0), getPixel(data, canvas.width, canvas.width - 1, 0), getPixel(data, canvas.width, 0, canvas.height - 1), getPixel(data, canvas.width, canvas.width - 1, canvas.height - 1)];
  const background = corners.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0]).map((value) => value / corners.length);
  const matchesBackground = (x: number, y: number) => {
    const pixel = getPixel(data, canvas.width, x, y);
    return Math.hypot(pixel[0] - background[0], pixel[1] - background[1], pixel[2] - background[2]) <= tolerance;
  };
  const total = canvas.width * canvas.height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    const index = y * canvas.width + x;
    if (visited[index] || !matchesBackground(x, y)) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < canvas.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, canvas.height - 1);
  }
  for (let y = 0; y < canvas.height; y += 1) {
    enqueue(0, y);
    enqueue(canvas.width - 1, y);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % canvas.width;
    const y = Math.floor(index / canvas.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < canvas.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < canvas.height) enqueue(x, y + 1);
  }
  for (let index = 0; index < total; index += 1) {
    if (visited[index]) data[index * 4 + 3] = 0;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvasBlob(canvas, 'image/png');
}

function reconstructRegion(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, region: { x: number; y: number; width: number; height: number }): void {
  const x = clamp(Math.round(region.x), 0, canvas.width - 1);
  const y = clamp(Math.round(region.y), 0, canvas.height - 1);
  const width = clamp(Math.round(region.width), 1, canvas.width - x);
  const height = clamp(Math.round(region.height), 1, canvas.height - y);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new Uint8ClampedArray(imageData.data);
  const blend = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      const px = x + xx;
      const py = y + yy;
      const u = (xx + 0.5) / width;
      const v = (yy + 0.5) / height;
      const left = getPixel(source, canvas.width, Math.max(0, x - 1), py);
      const right = getPixel(source, canvas.width, Math.min(canvas.width - 1, x + width), py);
      const top = getPixel(source, canvas.width, px, Math.max(0, y - 1));
      const bottom = getPixel(source, canvas.width, px, Math.min(canvas.height - 1, y + height));
      const target = (py * canvas.width + px) * 4;
      imageData.data[target] = (blend(left[0], right[0], u) + blend(top[0], bottom[0], v)) / 2;
      imageData.data[target + 1] = (blend(left[1], right[1], u) + blend(top[1], bottom[1], v)) / 2;
      imageData.data[target + 2] = (blend(left[2], right[2], u) + blend(top[2], bottom[2], v)) / 2;
      imageData.data[target + 3] = (blend(left[3], right[3], u) + blend(top[3], bottom[3], v)) / 2;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function fillRemoveRegion(blob: Blob, region: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(image, 0, 0);
  reconstructRegion(ctx, canvas, region);
  return canvasBlob(canvas, 'image/png');
}

export async function watermarkRemove(blob: Blob, region: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  return fillRemoveRegion(blob, region);
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function rasterToSvg(blob: Blob, columns = 48): Promise<Blob> {
  const image = await loadImage(blob);
  const scale = Math.min(1, Math.max(1, columns) / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const rects: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 16) {
        x += 1;
        continue;
      }
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      let run = 1;
      while (x + run < width) {
        const next = (y * width + x + run) * 4;
        if (data[next] !== r || data[next + 1] !== g || data[next + 2] !== b || data[next + 3] !== alpha) break;
        run += 1;
      }
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="rgb(${r},${g},${b})" fill-opacity="${(alpha / 255).toFixed(2)}"/>`);
      x += run;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><title>${escapeXml('FLIXO Raster to SVG')}</title>${rects.join('')}</svg>`;
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileChange(event: ChangeEvent<HTMLInputElement>): File | null {
  return event.target.files?.[0] ?? null;
}
