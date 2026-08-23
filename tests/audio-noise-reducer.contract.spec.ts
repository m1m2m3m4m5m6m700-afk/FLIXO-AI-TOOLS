import { expect, test } from '@playwright/test';
import { applyNoiseReduction, validateNoiseReductionOptions } from '../src/tools/audio-noise-reducer/engine';

test.describe('Audio Noise Reducer contracts', () => {
  test('rejects invalid reduction values', () => {
    expect(() => validateNoiseReductionOptions({ reduction: 2, highPassHz: 70 })).toThrow();
  });

  test('preserves sample count and returns finite samples', () => {
    const input = Float32Array.from({ length: 1024 }, (_, i) => Math.sin(i / 8) * 0.1);
    const output = applyNoiseReduction(input, { reduction: 0.65, highPassHz: 70 });
    expect(output).toHaveLength(input.length);
    expect(Array.from(output).every(Number.isFinite)).toBe(true);
  });

  test('keeps zero input zero', () => {
    const output = applyNoiseReduction(new Float32Array(32), { reduction: 0.8, highPassHz: 70 });
    expect(Array.from(output).every((sample) => sample === 0)).toBe(true);
  });
});
