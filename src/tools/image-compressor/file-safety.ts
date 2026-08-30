import { MAGIC_BYTE_SIGNATURES, validateFileSafety } from '../../lib/contracts/file-safety';

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

function imageMagicSignature(mime: string) {
  switch (mime) {
    case 'image/jpeg':
      return MAGIC_BYTE_SIGNATURES.jpeg;
    case 'image/png':
      return MAGIC_BYTE_SIGNATURES.png;
    case 'image/webp':
      return MAGIC_BYTE_SIGNATURES.webp;
    case 'image/gif':
      return MAGIC_BYTE_SIGNATURES.gif;
    case 'image/bmp':
      return MAGIC_BYTE_SIGNATURES.bmp;
    default:
      return undefined;
  }
}

function safetyError(failures: string[]) {
  if (failures.some((failure) => failure.startsWith('unsupported input MIME type:'))) {
    return new Error('Unsupported image format');
  }
  if (failures.includes('file exceeds the maximum size')) return new Error('File is larger than the 10 MB browser limit');
  if (failures.includes('input exceeds the maximum pixel count')) {
    return new Error('The source image is too large for safe browser processing. Reduce the dimensions and try again.');
  }
  if (failures.some((failure) => failure.includes('width') || failure.includes('height'))) {
    return new Error('The source image has invalid dimensions');
  }
  if (failures.includes('input magic bytes do not match the allowed file signatures')) {
    return new Error('The selected image file is invalid or corrupted');
  }
  if (failures.includes('input content is not valid UTF-8')) {
    return new Error('The selected SVG file is invalid');
  }
  return new Error(failures.join('; '));
}

export function assertSafeImageInput(
  file: Pick<File, 'name' | 'type' | 'size'>,
  dimensions?: { width: number; height: number },
  content?: Uint8Array,
) {
  const magicSignature = content ? imageMagicSignature(file.type) : undefined;
  const result = validateFileSafety(
    {
      name: file.name,
      mime: file.type,
      bytes: file.size,
      width: dimensions?.width,
      height: dimensions?.height,
      ...(content ? { content } : {}),
    },
    {
      allowedMime: IMAGE_COMPRESSOR_ALLOWED_MIME,
      maxBytes: IMAGE_COMPRESSOR_MAX_INPUT_SIZE,
      ...(dimensions ? { maxPixels: IMAGE_COMPRESSOR_MAX_PIXELS } : {}),
      ...(magicSignature ? { magicBytes: [magicSignature] } : {}),
      ...(file.type === 'image/svg+xml' && content ? { contentValidation: 'utf8' } : {}),
    },
  );

  if (!result.safe) throw safetyError(result.failures);
}

export async function assertSafeImageFile(file: Pick<File, 'name' | 'type' | 'size'> & Pick<File, 'arrayBuffer'>) {
  const content = new Uint8Array(await file.arrayBuffer());
  assertSafeImageInput(file, undefined, content);
}
