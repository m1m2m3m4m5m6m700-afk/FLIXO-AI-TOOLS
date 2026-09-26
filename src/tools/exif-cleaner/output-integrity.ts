import { validateOutputIntegrity, type OutputIntegritySpec } from '../../lib/contracts/output-integrity';

export const exifCleanerIntegritySpec = {
  toolId: 'exif-cleaner',
  allowedMime: ['image/png'],
  minBytes: 1,
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 40_000_000,
} as const satisfies OutputIntegritySpec;

export function assertExifCleanerOutputIntegrity(blob: Blob, dimensions: { width: number; height: number }): void {
  const result = validateOutputIntegrity(blob.size, blob.type, exifCleanerIntegritySpec, dimensions);
  if (!result.valid) throw new Error(`EXIF Cleaner produced an invalid output: ${result.failures.join('; ')}`);
}
