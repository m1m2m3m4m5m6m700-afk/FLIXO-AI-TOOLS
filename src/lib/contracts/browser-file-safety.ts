import { MAGIC_BYTE_SIGNATURES, validateFileSafety, type FileSafetyResult, type FileSafetyPolicy } from './file-safety.ts';

export type BrowserFileValidationPolicy = FileSafetyPolicy & {
  decoder?: (file: File) => Promise<void>;
};

export type BrowserFileValidationResult = FileSafetyResult & {
  decoded: boolean;
};

const DEFAULT_IMAGE_POLICY: BrowserFileValidationPolicy = {
  maxBytes: 25 * 1024 * 1024,
  allowedMime: ['image/avif', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'webp'],
  magicBytes: [
    MAGIC_BYTE_SIGNATURES.avif,
    MAGIC_BYTE_SIGNATURES.bmp,
    MAGIC_BYTE_SIGNATURES.gif,
    MAGIC_BYTE_SIGNATURES.jpeg,
    MAGIC_BYTE_SIGNATURES.png,
    MAGIC_BYTE_SIGNATURES.webp,
  ],
};

async function decodeImage(file: File): Promise<void> {
  if ('createImageBitmap' in window && typeof window.createImageBitmap === 'function') {
    const bitmap = await window.createImageBitmap(file);
    bitmap.close();
    return;
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function validateBrowserFile(
  file: File,
  policy: BrowserFileValidationPolicy = DEFAULT_IMAGE_POLICY,
): Promise<BrowserFileValidationResult> {
  const failures: string[] = [];
  let content: Uint8Array;

  try {
    content = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { safe: false, failures: ['failed to read file bytes'], decoded: false };
  }

  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : '';
  if (extension && policy.allowedExtensions?.includes(extension)) {
    const expectedMime = { ...EXTENSION_MIME_OVERRIDES }[extension];
    if (expectedMime && file.type !== expectedMime) failures.push(`file extension does not match MIME type: .${extension} -> ${file.type}`);
  }

  const safety = validateFileSafety(
    {
      name: file.name,
      mime: file.type,
      bytes: file.size,
      content,
      signature: Array.from(content.slice(0, 16), (value) => value.toString(16).padStart(2, '0')).join(''),
    },
    policy,
  );
  failures.push(...safety.failures);

  let decoded = false;
  if (failures.length === 0 && policy.decoder) {
    try {
      await policy.decoder(file);
      decoded = true;
    } catch {
      failures.push('file decoder rejected the input');
    }
  }

  return { safe: failures.length === 0, failures, decoded };
}

const EXTENSION_MIME_OVERRIDES: Record<string, string> = Object.freeze({
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});

export const IMAGE_BROWSER_FILE_POLICY: BrowserFileValidationPolicy = Object.freeze({
  ...DEFAULT_IMAGE_POLICY,
  decoder: decodeImage,
});
