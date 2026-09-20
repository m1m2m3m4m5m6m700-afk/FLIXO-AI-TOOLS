import type { FilterMaskParameters } from './handoff';

export type FrameCrop = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export const canvasDimensions = (
  video: HTMLVideoElement,
  aspectRatio: FilterMaskParameters['aspectRatio'],
  captureQuality: FilterMaskParameters['captureQuality'],
): { width: number; height: number } => {
  const [rawWidth, rawHeight] = aspectRatio.split(':').map(Number);
  const ratio = rawWidth / rawHeight;
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const maxLongSide = captureQuality === '1080p' ? 1920 : 1280;
  const longSide = Math.min(maxLongSide, Math.max(sourceWidth, sourceHeight));

  if (ratio >= 1) return { width: Math.round(longSide), height: Math.round(longSide / ratio) };
  return { width: Math.round(longSide * ratio), height: Math.round(longSide) };
};

export function frameCrop(
  video: HTMLVideoElement,
  width: number,
  height: number,
  zoom: number,
): FrameCrop {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const targetAspect = width / height;
  const sourceAspect = sourceWidth / sourceHeight;
  const baseCropWidth = sourceAspect > targetAspect ? sourceHeight * targetAspect : sourceWidth;
  const baseCropHeight = sourceAspect > targetAspect ? sourceHeight : sourceWidth / targetAspect;
  const cropWidth = Math.min(sourceWidth, baseCropWidth / zoom);
  const cropHeight = Math.min(sourceHeight, baseCropHeight / zoom);
  return {
    x: (sourceWidth - cropWidth) / 2,
    y: (sourceHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

export function drawFilteredFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  cssFilter: string,
  intensity: number,
  zoom: number,
  mirror: boolean,
): void {
  const crop = frameCrop(video, width, height, zoom);

  const drawLayer = (filter: string, alpha: number) => {
    ctx.save();
    ctx.filter = filter;
    ctx.globalAlpha = alpha;
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    ctx.restore();
  };

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  if (cssFilter === 'none' || intensity >= 100) drawLayer(cssFilter === 'none' ? 'none' : cssFilter, 1);
  else {
    drawLayer('none', 1);
    drawLayer(cssFilter, intensity / 100);
  }
  ctx.restore();
}
