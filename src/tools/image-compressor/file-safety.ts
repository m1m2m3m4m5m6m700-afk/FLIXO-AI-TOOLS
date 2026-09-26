import { validateFileSafety } from '../../lib/contracts/file-safety.ts';

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

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageSafetyInput {
  name: string;
  type: string;
  size: number;
}

function safetyError(failures: string[]): Error {
  if (failures.some((failure) => failure.startsWith('unsupported input MIME type:'))) {
    return new Error('Unsupported image format');
  }
  if (failures.includes('file exceeds the maximum size')) {
    return new Error('File is larger than the 10 MB browser limit');
  }
  if (
    failures.includes('pixel count exceeds policy limit') ||
    failures.includes('input exceeds the maximum pixel count')
  ) {
    return new Error(
      'The source image is too large for safe browser processing. Reduce the dimensions and try again.',
    );
  }
  if (failures.some((failure) => failure.includes('width') || failure.includes('height'))) {
    return new Error('The source image has invalid dimensions');
  }
  return new Error(failures.join('; '));
}

export function assertSafeImageInput(
  file: ImageSafetyInput,
  dimensions?: ImageDimensions,
): void {
  if (!file.name.trim()) {
    throw new Error('Image file name is required');
  }
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Invalid image file size');
  }

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

  if (!result.safe) {
    throw safetyError(result.failures);
  }
}
