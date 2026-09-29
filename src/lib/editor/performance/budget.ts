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

export const assertResourceBudget = (
  width: number,
  height: number,
  estimatedBytes: number,
  budget: ResourceBudget = DEFAULT_RESOURCE_BUDGET,
): true => {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error('RESOURCE_DIMENSIONS_INVALID');
  if (!Number.isFinite(estimatedBytes) || estimatedBytes < 0) throw new Error('RESOURCE_BYTES_INVALID');
  if (width * height > budget.maxPixels) throw new Error('RESOURCE_PIXEL_BUDGET_EXCEEDED');
  if (estimatedBytes > budget.maxBytes) throw new Error('RESOURCE_BYTE_BUDGET_EXCEEDED');
  return true;
};

export const estimateRgbaBytes = (width: number, height: number): number => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('RESOURCE_DIMENSIONS_INVALID');
  }
  return width * height * 4;
};
