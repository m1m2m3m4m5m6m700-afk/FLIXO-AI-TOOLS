import type { CapabilityParameters } from '@/config/canonical-tool-definition.ts';

export type VisualDimensionRule =
  | Readonly<{ kind: 'PRESERVE' }>
  | Readonly<{ kind: 'EXACT'; width: number; height: number }>
  | Readonly<{ kind: 'SCALE'; scale: number }>
  | Readonly<{ kind: 'ASPECT'; ratio: number }>;

export type VisualGoalSpec = Readonly<{
  toolId: string;
  dimensions: VisualDimensionRule;
  requireVisibleChange: boolean;
  minVisibleChangeScore: number;
}>;

export type VisualRaster = Readonly<{
  width: number;
  height: number;
  pixels: Uint8Array;
}>;

export type VisualGoalReport = Readonly<{
  verified: boolean;
  geometryVerified: boolean;
  visibleChangeVerified: boolean;
  visibleChangeScore: number | null;
  reasons: readonly string[];
  mode: 'FULL' | 'GEOMETRY_ONLY' | 'NO_BROWSER_DECODER';
}>;

const EFFECT_DEFAULTS = Object.freeze({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0 });

function parseAspectRatio(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,3}):(\d{1,3})$/u.exec(value.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : null;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function deriveVisualGoalSpec(toolId: string, parameters: CapabilityParameters = {}): VisualGoalSpec {
  if (toolId === 'image-upscaler') {
    const scale = Number(parameters.scale ?? 2);
    return Object.freeze({
      toolId,
      dimensions: { kind: 'SCALE', scale: Number.isFinite(scale) && scale > 0 ? scale : 2 },
      requireVisibleChange: false,
      minVisibleChangeScore: 0,
    });
  }

  if (toolId === 'image-cropper') {
    const width = Number(parameters.width);
    const height = Number(parameters.height);
    if (Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0) {
      return Object.freeze({ toolId, dimensions: { kind: 'EXACT', width, height }, requireVisibleChange: false, minVisibleChangeScore: 0 });
    }
    const ratio = parseAspectRatio(parameters.aspectRatio);
    if (ratio !== null) {
      return Object.freeze({ toolId, dimensions: { kind: 'ASPECT', ratio }, requireVisibleChange: false, minVisibleChangeScore: 0 });
    }
    return Object.freeze({ toolId, dimensions: { kind: 'PRESERVE' }, requireVisibleChange: false, minVisibleChangeScore: 0 });
  }

  if (toolId === 'image-compressor' || toolId === 'image-converter') {
    return Object.freeze({ toolId, dimensions: { kind: 'PRESERVE' }, requireVisibleChange: false, minVisibleChangeScore: 0 });
  }

  if (toolId === 'image-effects') {
    const requireVisibleChange = Object.entries(EFFECT_DEFAULTS).some(([key, defaultValue]) => {
      const actual = Number(parameters[key] ?? defaultValue);
      return Number.isFinite(actual) && actual !== defaultValue;
    });
    return Object.freeze({
      toolId,
      dimensions: { kind: 'PRESERVE' },
      requireVisibleChange,
      minVisibleChangeScore: requireVisibleChange ? 0.001 : 0,
    });
  }

  return Object.freeze({ toolId, dimensions: { kind: 'PRESERVE' }, requireVisibleChange: false, minVisibleChangeScore: 0 });
}

function assertRaster(raster: VisualRaster): void {
  if (!Number.isInteger(raster.width) || raster.width <= 0) throw new Error('Visual raster width is invalid.');
  if (!Number.isInteger(raster.height) || raster.height <= 0) throw new Error('Visual raster height is invalid.');
  if (raster.pixels.length !== raster.width * raster.height * 4) throw new Error('Visual raster pixel length is invalid.');
}

function dimensionMatches(rule: VisualDimensionRule, input: VisualRaster, output: VisualRaster): boolean {
  if (rule.kind === 'PRESERVE') return output.width === input.width && output.height === input.height;
  if (rule.kind === 'EXACT') return output.width === rule.width && output.height === rule.height;
  if (rule.kind === 'SCALE') return output.width === Math.max(1, Math.round(input.width * rule.scale)) && output.height === Math.max(1, Math.round(input.height * rule.scale));
  const outputRatio = output.width / output.height;
  return Math.abs(outputRatio - rule.ratio) <= Math.max(0.002, rule.ratio * 0.002);
}

export function visualChangeScore(input: VisualRaster, output: VisualRaster): number | null {
  assertRaster(input);
  assertRaster(output);
  if (input.width !== output.width || input.height !== output.height) return null;
  let difference = 0;
  for (let index = 0; index < input.pixels.length; index += 1) difference += Math.abs(input.pixels[index] - output.pixels[index]);
  return clamp(difference / (input.pixels.length * 255));
}

export function assessVisualGoal(spec: VisualGoalSpec, input: VisualRaster, output: VisualRaster): VisualGoalReport {
  assertRaster(input);
  assertRaster(output);
  const geometryVerified = dimensionMatches(spec.dimensions, input, output);
  if (!geometryVerified) {
    return Object.freeze({
      verified: false, geometryVerified: false, visibleChangeVerified: !spec.requireVisibleChange,
      visibleChangeScore: null, reasons: Object.freeze(['VISUAL_GOAL_DIMENSIONS_MISMATCH']), mode: 'FULL',
    });
  }
  if (!spec.requireVisibleChange) {
    return Object.freeze({
      verified: true, geometryVerified: true, visibleChangeVerified: true,
      visibleChangeScore: null, reasons: Object.freeze([]), mode: 'GEOMETRY_ONLY',
    });
  }
  const score = visualChangeScore(input, output);
  const visibleChangeVerified = score !== null && score >= spec.minVisibleChangeScore;
  return Object.freeze({
    verified: visibleChangeVerified,
    geometryVerified: true,
    visibleChangeVerified,
    visibleChangeScore: score,
    reasons: visibleChangeVerified ? Object.freeze([]) : Object.freeze(['VISUAL_GOAL_NO_MEANINGFUL_CHANGE']),
    mode: 'FULL',
  });
}

async function decodeBlob(blob: Blob): Promise<VisualRaster | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  const bitmap = await createImageBitmap(blob);
  const maxDimension = 32;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  try {
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    context.drawImage(bitmap, 0, 0, width, height);
    return { width, height, pixels: new Uint8Array(context.getImageData(0, 0, width, height).data) };
  } finally {
    bitmap.close();
  }
}

export async function verifyVisualGoal(
  inputBlob: Blob,
  outputBlob: Blob,
  toolId: string,
  parameters: CapabilityParameters = {},
  signal?: AbortSignal,
): Promise<VisualGoalReport> {
  const spec = deriveVisualGoalSpec(toolId, parameters);
  if (signal?.aborted) {
    return Object.freeze({
      verified: false, geometryVerified: false, visibleChangeVerified: false,
      visibleChangeScore: null, reasons: Object.freeze(['VISUAL_GOAL_ABORTED']), mode: 'FULL',
    });
  }
  const [input, output] = await Promise.all([decodeBlob(inputBlob), decodeBlob(outputBlob)]);
  if (!input || !output) {
    return Object.freeze({
      verified: true, geometryVerified: true, visibleChangeVerified: true,
      visibleChangeScore: null, reasons: Object.freeze(['VISUAL_GOAL_DECODER_UNAVAILABLE']), mode: 'NO_BROWSER_DECODER',
    });
  }
  return assessVisualGoal(spec, input, output);
}
