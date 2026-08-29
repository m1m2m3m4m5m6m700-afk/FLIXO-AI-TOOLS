import { validateFileSafety, type FileSafetyPolicy, type FileSafetyResult } from './file-safety.ts';

export type UploadBoundaryPolicy = FileSafetyPolicy & {
  allowedExtensions?: readonly string[];
  signatures: readonly string[];
};

export type UploadBoundaryInput = {
  name: string;
  mime: string;
  bytes: Uint8Array;
  width?: number;
  height?: number;
};

export type UploadBoundaryResult = FileSafetyResult & {
  signature: string;
};

const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = Object.freeze({
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
});

function normalizeExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0) return '';
  return name.slice(lastDot + 1).trim().toLowerCase();
}

function bytesToHex(bytes: Uint8Array, limit = 16): string {
  return Array.from(bytes.slice(0, limit), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function validateUploadBoundary(
  input: UploadBoundaryInput,
  policy: UploadBoundaryPolicy,
): UploadBoundaryResult {
  const signature = bytesToHex(input.bytes);
  const failures: string[] = [];
  const extension = normalizeExtension(input.name);

  if (policy.allowedExtensions) {
    if (!extension || !policy.allowedExtensions.includes(extension)) {
      failures.push(`unsupported file extension: ${extension || '(none)'}`);
    }

    const expectedMime = EXTENSION_MIME_MAP[extension];
    if (expectedMime && expectedMime !== input.mime) {
      failures.push(`file extension does not match MIME type: .${extension} -> ${input.mime}`);
    }
  }

  const safety = validateFileSafety(
    {
      name: input.name,
      mime: input.mime,
      bytes: input.bytes.byteLength,
      width: input.width,
      height: input.height,
      signature,
    },
    policy,
  );

  failures.push(...safety.failures);
  return { safe: failures.length === 0, failures, signature };
}
