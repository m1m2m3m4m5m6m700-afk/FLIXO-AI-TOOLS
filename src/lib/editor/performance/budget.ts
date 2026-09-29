export type ResourceBudget = Readonly<{
  maxPixels: number;
  maxBytes: number;
  maxMilliseconds: number;
  maxTiles: number;
}>;

export const DEFAULT_RESOURCE_BUDGET: ResourceBudget = Object.freeze({
  maxPixels: 64_000_000,
  maxBytes: 512 * 1024 * 1024,
  maxMilliseconds: 15_000,
  maxTiles: 16_384,
});

const assertPositiveInteger = (value: number, code: string): void => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
};

export const assertValidResourceBudget = (budget: ResourceBudget): true => {
  assertPositiveInteger(budget.maxPixels, 'RESOURCE_PIXEL_LIMIT_INVALID');
  assertPositiveInteger(budget.maxBytes, 'RESOURCE_BYTE_LIMIT_INVALID');
  assertPositiveInteger(budget.maxMilliseconds, 'RESOURCE_TIME_LIMIT_INVALID');
  assertPositiveInteger(budget.maxTiles, 'RESOURCE_TILE_LIMIT_INVALID');
  return true;
};

export const assertResourceBudget = (
  width: number,
  height: number,
  estimatedBytes: number,
  estimatedTiles = 0,
  budget: ResourceBudget = DEFAULT_RESOURCE_BUDGET,
): true => {
  assertValidResourceBudget(budget);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error('RESOURCE_DIMENSIONS_INVALID');
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) throw new Error('RESOURCE_DIMENSIONS_UNSAFE');
  if (!Number.isFinite(estimatedBytes) || estimatedBytes < 0 || !Number.isSafeInteger(estimatedBytes)) throw new Error('RESOURCE_BYTES_INVALID');
  if (!Number.isSafeInteger(estimatedTiles) || estimatedTiles < 0) throw new Error('RESOURCE_TILES_INVALID');
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels)) throw new Error('RESOURCE_PIXEL_COUNT_UNSAFE');
  if (pixels > budget.maxPixels) throw new Error('RESOURCE_PIXEL_BUDGET_EXCEEDED');
  if (estimatedBytes > budget.maxBytes) throw new Error('RESOURCE_BYTE_BUDGET_EXCEEDED');
  if (estimatedTiles > budget.maxTiles) throw new Error('RESOURCE_TILE_BUDGET_EXCEEDED');
  return true;
};

export const estimateRgbaBytes = (width: number, height: number): number => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('RESOURCE_DIMENSIONS_INVALID');
  const bytes = width * height * 4;
  if (!Number.isSafeInteger(bytes)) throw new Error('RESOURCE_BYTE_COUNT_UNSAFE');
  return bytes;
};
