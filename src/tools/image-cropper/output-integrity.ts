import { validateOutputIntegrity, type OutputIntegritySpec } from '../../lib/contracts/output-integrity';

export const imageCropperIntegritySpec = {
  toolId: 'image-cropper',
  allowedMime: ['image/png'],
  minBytes: 1,
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 40_000_000,
} as const satisfies OutputIntegritySpec;

export function assertImageCropperOutputIntegrity(
  blob: Blob,
  dimensions: { width: number; height: number },
): void {
  const result = validateOutputIntegrity(blob.size, blob.type, imageCropperIntegritySpec, dimensions);
  if (!result.valid) {
    throw new Error(`Image Cropper produced an invalid output: ${result.failures.join('; ')}`);
  }
}
