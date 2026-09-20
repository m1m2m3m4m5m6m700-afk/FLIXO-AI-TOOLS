import { validateOutputIntegrity, type OutputIntegritySpec } from '../../lib/contracts/output-integrity';

export const imageConverterIntegritySpec = {
  toolId: 'image-converter',
  allowedMime: ['image/png', 'image/jpeg', 'image/webp'],
  minBytes: 1,
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 40_000_000,
} as const satisfies OutputIntegritySpec;

export function assertImageConverterOutputIntegrity(
  blob: Blob,
  dimensions: { width: number; height: number },
): void {
  const result = validateOutputIntegrity(blob.size, blob.type, imageConverterIntegritySpec, dimensions);
  if (!result.valid) {
    throw new Error(`Image Converter produced an invalid output: ${result.failures.join('; ')}`);
  }
}
