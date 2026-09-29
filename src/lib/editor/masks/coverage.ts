import type { CoverageField } from './types';

const assertDimensions = (width: number, height: number): void => {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new Error('MASK_DIMENSIONS_INVALID');
  }
};

export const createCoverage = (width: number, height: number, fill = 0): CoverageField => {
  assertDimensions(width, height);
  if (!Number.isFinite(fill) || fill < 0 || fill > 1) throw new Error('MASK_FILL_INVALID');
  return Object.freeze({
    width,
    height,
    values: new Float32Array(width * height).fill(fill),
  });
};

export const mapCoverage = (
  field: CoverageField,
  mapper: (value: number, index: number) => number,
): CoverageField => {
  const values = new Float32Array(field.values.length);
  for (let i = 0; i < field.values.length; i += 1) {
    const value = mapper(field.values[i] ?? 0, i);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('MASK_VALUE_INVALID');
    values[i] = value;
  }
  return Object.freeze({ width: field.width, height: field.height, values });
};

export const combineCoverage = (
  left: CoverageField,
  right: CoverageField,
  operation: 'add' | 'subtract' | 'intersect' | 'multiply',
): CoverageField => {
  if (left.width !== right.width || left.height !== right.height) throw new Error('MASK_DIMENSIONS_MISMATCH');
  return mapCoverage(left, (value, index) => {
    const other = right.values[index] ?? 0;
    switch (operation) {
      case 'add': return Math.min(1, value + other);
      case 'subtract': return Math.max(0, value - other);
      case 'intersect': return Math.min(value, other);
      case 'multiply': return value * other;
    }
  });
};

export const invertCoverage = (field: CoverageField): CoverageField =>
  mapCoverage(field, (value) => 1 - value);
