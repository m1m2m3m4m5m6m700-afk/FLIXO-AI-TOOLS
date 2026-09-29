export type CurvePoint = { x: number; y: number };
export type BrushStroke = { x: number; y: number; radius: number; opacity: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type AdvancedSeedSettings = {
  curves: CurvePoint[];
  brush: BrushStroke[];
  brushStrength: number;
  perspectiveX: number;
  perspectiveY: number;
  lensBlur: number;
  bokeh: number;
  heal: Rect | null;
  doubleExposure: HTMLImageElement | null;
  doubleExposureOpacity: number;
  doubleExposureBlend: GlobalCompositeOperation;
};

export const DEFAULT_ADVANCED: AdvancedSeedSettings = {
  curves: [{ x: 0, y: 0 }, { x: 0.25, y: 0.25 }, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.75 }, { x: 1, y: 1 }],
  brush: [], brushStrength: 0, perspectiveX: 0, perspectiveY: 0,
  lensBlur: 0, bokeh: 0, heal: null, doubleExposure: null,
  doubleExposureOpacity: 0, doubleExposureBlend: 'screen',
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

function buildLut(points: CurvePoint[], size = 256) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  return new Uint8ClampedArray(Array.from({ length: size }, (_, i) => {
    const x = i / (size - 1);
    let left = sorted[0];
    let right = sorted[sorted.length - 1];
    for (let j = 0; j < sorted.length - 1; j += 1) {
      if (x >= sorted[j].x && x <= sorted[j + 1].x) { left = sorted[j]; right = sorted[j + 1]; break; }
    }
    const t = clamp((x - left.x) / Math.max(1e-6, right.x - left.x));
    return Math.round(clamp(left.y + (right.y - left.y) * t) * 255);
  }));
}

function applyCurves(ctx: CanvasRenderingContext2D, points: CurvePoint[]) {
  if (points.length < 2) return;
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const lut = buildLut(points);
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = lut[image.data[i]];
    image.data[i + 1] = lut[image.data[i + 1]];
    image.data[i + 2] = lut[image.data[i + 2]];
  }
  ctx.putImageData(image, 0, 0);
}

function applyBrush(ctx: CanvasRenderingContext2D, strokes: BrushStroke[], strength: number) {
  if (!strokes.length || strength === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = strength > 0 ? 'screen' : 'multiply';
  ctx.globalAlpha = Math.abs(strength) / 100;
  for (const stroke of strokes) {
    const gradient = ctx.createRadialGradient(stroke.x, stroke.y, 0, stroke.x, stroke.y, stroke.radius);
    const a = Math.abs(strength) / 100 * stroke.opacity;
    gradient.addColorStop(0, `rgba(255,255,255,${a})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(stroke.x, stroke.y, stroke.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function applyPerspective(ctx: CanvasRenderingContext2D, x: number, y: number) {
  if (x === 0 && y === 0) return;
  const canvas = ctx.canvas;
  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width; snapshot.height = canvas.height;
  snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sx = Math.max(-0.25, Math.min(0.25, x / 100));
  const sy = Math.max(-0.25, Math.min(0.25, y / 100));
  ctx.save();
  ctx.transform(1, sy, sx, 1, -canvas.width * sx * 0.5, -canvas.height * sy * 0.5);
  ctx.drawImage(snapshot, 0, 0);
  ctx.restore();
}

function applyLensBlur(ctx: CanvasRenderingContext2D, radius: number, bokeh: number) {
  if (radius <= 0) return;
  const canvas = ctx.canvas;
  const blurred = document.createElement('canvas');
  blurred.width = canvas.width; blurred.height = canvas.height;
  const b = blurred.getContext('2d'); if (!b) return;
  b.filter = `blur(${Math.min(40, radius)}px)`; b.drawImage(canvas, 0, 0);
  const focus = ctx.createLinearGradient(0, 0, 0, canvas.height);
  const center = 0.5 - bokeh / 200;
  focus.addColorStop(Math.max(0, center - 0.18), 'rgba(0,0,0,1)');
  focus.addColorStop(Math.max(0.02, center - 0.04), 'rgba(0,0,0,0)');
  focus.addColorStop(Math.min(0.98, center + 0.04), 'rgba(0,0,0,0)');
  focus.addColorStop(Math.min(1, center + 0.18), 'rgba(0,0,0,1)');
  ctx.save();
  const sharp = document.createElement('canvas'); sharp.width = canvas.width; sharp.height = canvas.height;
  sharp.getContext('2d')?.drawImage(canvas, 0, 0);
  ctx.globalAlpha = 1; ctx.drawImage(blurred, 0, 0);
  ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = focus; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-over'; ctx.globalAlpha = 1; ctx.drawImage(sharp, 0, 0);
  ctx.restore();
}

function applyHealing(ctx: CanvasRenderingContext2D, rect: Rect | null) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return;
  const source = document.createElement('canvas');
  source.width = ctx.canvas.width; source.height = ctx.canvas.height;
  source.getContext('2d')?.drawImage(ctx.canvas, 0, 0);
  const sx = Math.max(0, rect.x - rect.width - 4);
  const sy = Math.max(0, rect.y - rect.height - 4);
  ctx.save(); ctx.globalAlpha = 0.96; ctx.filter = 'blur(1px)';
  ctx.drawImage(source, sx, sy, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function blendChannel(base: number, source: number, mode: GlobalCompositeOperation): number {
  switch (mode) {
    case 'multiply':
      return (base * source) / 255;
    case 'screen':
      return 255 - ((255 - base) * (255 - source)) / 255;
    case 'overlay':
      return base < 128 ? (2 * base * source) / 255 : 255 - (2 * (255 - base) * (255 - source)) / 255;
    case 'soft-light': {
      const b = base / 255;
      const s = source / 255;
      const result = s <= 0.5
        ? b - (1 - 2 * s) * b * (1 - b)
        : b + (2 * s - 1) * (Math.sqrt(b) - b);
      return result * 255;
    }
    default:
      return source;
  }
}

function applyDoubleExposure(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, opacity: number, blend: GlobalCompositeOperation) {
  if (!image || opacity <= 0) return;

  // Avoid browser-dependent Canvas compositing here. WebKit has historically
  // had implementation/performance differences around globalCompositeOperation;
  // flattening the supported blend modes in pixel space keeps export deterministic.
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext('2d', { willReadFrequently: true });
  if (!layerCtx) return;
  layerCtx.drawImage(image, 0, 0, width, height);

  const base = ctx.getImageData(0, 0, width, height);
  const source = layerCtx.getImageData(0, 0, width, height);
  const alpha = Math.min(1, Math.max(0, opacity / 100));

  for (let i = 0; i < base.data.length; i += 4) {
    const sourceAlpha = (source.data[i + 3] / 255) * alpha;
    if (sourceAlpha <= 0) continue;
    const inverse = 1 - sourceAlpha;

    base.data[i] = blendChannel(base.data[i], source.data[i], blend) * sourceAlpha + base.data[i] * inverse;
    base.data[i + 1] = blendChannel(base.data[i + 1], source.data[i + 1], blend) * sourceAlpha + base.data[i + 1] * inverse;
    base.data[i + 2] = blendChannel(base.data[i + 2], source.data[i + 2], blend) * sourceAlpha + base.data[i + 2] * inverse;
    base.data[i + 3] = Math.min(255, source.data[i + 3] * alpha + base.data[i + 3] * inverse);
  }

  ctx.putImageData(base, 0, 0);
}

export function renderAdvanced(ctx: CanvasRenderingContext2D, settings: AdvancedSeedSettings) {
  applyPerspective(ctx, settings.perspectiveX, settings.perspectiveY);
  applyLensBlur(ctx, settings.lensBlur, settings.bokeh);
  applyHealing(ctx, settings.heal);
  applyBrush(ctx, settings.brush, settings.brushStrength);
  applyCurves(ctx, settings.curves);
  applyDoubleExposure(ctx, settings.doubleExposure, settings.doubleExposureOpacity, settings.doubleExposureBlend);
}
