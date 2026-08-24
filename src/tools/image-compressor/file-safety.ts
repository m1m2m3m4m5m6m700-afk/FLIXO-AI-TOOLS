import { validateFileSafety } from '../../lib/contracts/file-safety';

export const IMAGE_COMPRESSOR_MAX_INPUT_SIZE = 10 * 1024 * 1024;
export const IMAGE_COMPRESSOR_MAX_PIXELS = 40_000_000;

const IMAGE_COMPRESSOR_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
] as const;

function safetyError(failures: string[]) {
  if (failures.includes('unsupported input MIME type')) return new Error('Unsupported image format');
  if (failures.includes('file exceeds the maximum size')) return new Error('File is larger than the 10 MB browser limit');
  if (failures.includes('input exceeds the maximum pixel count')) {
    return new Error('The source image is too large for safe browser processing. Reduce the dimensions and try again.');
  }
  if (failures.some((failure) => failure.includes('width') || failure.includes('height'))) {
    return new Error('The source image has invalid dimensions');
  }
  return new Error(failures.join('; '));
}

export function assertSafeImageInput(
  file: Pick<File, 'name' | 'type' | 'size'>,
  dimensions?: { width: number; height: number },
) {
  const result = validateFileSafety(
    {
      name: file.name,
      mime: file.type,
      bytes: file.size,
      width: dimensions?.width,
      height: dimensions?.height,
    },
    {
      allowedMime: IMAGE_COMPRESSOR_ALLOWED_MIME,
      maxBytes: IMAGE_COMPRESSOR_MAX_INPUT_SIZE,
      ...(dimensions ? { maxPixels: IMAGE_COMPRESSOR_MAX_PIXELS } : {}),
    },
  );

  if (!result.safe) throw safetyError(result.failures);
}
