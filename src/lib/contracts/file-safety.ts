export type FileSafetyInput = {
  name: string;
  mime: string;
  bytes: number;
  signature?: string;
  width?: number;
  height?: number;
};

export type FileSafetyPolicy = {
  allowedMime: readonly string[];
  maxBytes: number;
  maxPixels?: number;
  signatures?: readonly string[];
  allowedExtensions?: readonly string[];
};

export type FileSafetyResult = {
  safe: boolean;
  failures: string[];
};

export type ArchiveEntry = {
  name: string;
  uncompressedBytes?: number;
  isSymlink?: boolean;
};

export type ArchiveSafetyPolicy = {
  maxEntries: number;
  maxUncompressedBytes: number;
  maxDepth: number;
};

export const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = Object.freeze({
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
});

function normalizeExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0) return '';
  return name.slice(lastDot + 1).trim().toLowerCase();
}

function normalizeSignature(signature: string): string {
  return signature.replace(/\s+/g, '').toLowerCase();
}

function isUnsafeName(name: string): boolean {
  if (!name.trim()) return true;
  if (/^[A-Za-z]:($|[\\/])/.test(name)) return true;
  if (/^[/\\]/.test(name)) return true;
  if (/[\u0000-\u001f\u007f]/.test(name)) return true;
  const normalized = name.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments.some((segment) => segment === '..' || segment === '.') || segments.length !== 1;
}

export function validateFileSafety(input: FileSafetyInput, policy: FileSafetyPolicy): FileSafetyResult {
  const failures: string[] = [];
  const name = input.name.trim();
  const extension = normalizeExtension(name);

  if (!name) failures.push('file name is required');
  else if (isUnsafeName(name)) failures.push('file name must be a single safe relative name');

  if (!Number.isInteger(input.bytes) || input.bytes < 1) failures.push('file size must be a positive integer');
  if (input.bytes > policy.maxBytes) failures.push('file exceeds the maximum size');
  if (!policy.allowedMime.includes(input.mime)) failures.push(`unsupported input MIME type: ${input.mime}`);

  if (policy.allowedExtensions) {
    if (!extension || !policy.allowedExtensions.includes(extension)) {
      failures.push(`unsupported file extension: ${extension || '(none)'}`);
    }
    const expectedMime = EXTENSION_MIME_MAP[extension];
    if (expectedMime && expectedMime !== input.mime) {
      failures.push(`file extension does not match MIME type: .${extension} -> ${input.mime}`);
    }
  }

  if (input.width !== undefined || input.height !== undefined) {
    if (!Number.isInteger(input.width) || !input.width || input.width < 1) failures.push('width must be a positive integer');
    if (!Number.isInteger(input.height) || !input.height || input.height < 1) failures.push('height must be a positive integer');
    if (policy.maxPixels !== undefined && Number(input.width) * Number(input.height) > policy.maxPixels) {
      failures.push('input exceeds the maximum pixel count');
    }
  }

  if (policy.signatures) {
    if (!input.signature) {
      failures.push('input signature is required when signature validation is enabled');
    } else {
      const signature = normalizeSignature(input.signature);
      if (!policy.signatures.some((allowed) => signature.startsWith(normalizeSignature(allowed)))) {
        failures.push('input signature does not match the allowed file signatures');
      }
    }
  }

  return { safe: failures.length === 0, failures };
}

export function validateArchiveEntries(
  entries: readonly ArchiveEntry[],
  policy: ArchiveSafetyPolicy,
): FileSafetyResult {
  const failures: string[] = [];
  let totalBytes = 0;

  if (!Number.isInteger(policy.maxEntries) || policy.maxEntries < 1) failures.push('archive maximum entry count must be a positive integer');
  if (!Number.isInteger(policy.maxUncompressedBytes) || policy.maxUncompressedBytes < 1) {
    failures.push('archive maximum uncompressed size must be a positive integer');
  }
  if (!Number.isInteger(policy.maxDepth) || policy.maxDepth < 0) failures.push('archive maximum depth must be a non-negative integer');

  if (entries.length > policy.maxEntries) failures.push('archive exceeds the maximum entry count');

  for (const entry of entries) {
    const normalized = entry.name.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    const depth = Math.max(0, segments.length - 1);

    if (!entry.name || /^[/\\]/.test(entry.name) || /^[A-Za-z]:($|[\\/])/.test(entry.name)) {
      failures.push(`archive entry has an unsafe absolute path: ${entry.name || '(empty)'}`);
    }
    if (segments.some((segment) => segment === '..' || segment === '.')) {
      failures.push(`archive entry contains an unsafe path segment: ${entry.name}`);
    }
    if (depth > policy.maxDepth) failures.push(`archive entry exceeds the maximum path depth: ${entry.name}`);
    if (entry.isSymlink) failures.push(`archive symlink entries are not allowed: ${entry.name}`);

    if (entry.uncompressedBytes !== undefined) {
      if (!Number.isInteger(entry.uncompressedBytes) || entry.uncompressedBytes < 0) {
        failures.push(`archive entry has an invalid uncompressed size: ${entry.name}`);
      } else {
        totalBytes += entry.uncompressedBytes;
        if (totalBytes > policy.maxUncompressedBytes) {
          failures.push('archive exceeds the maximum uncompressed size');
          break;
        }
      }
    }
  }

  return { safe: failures.length === 0, failures };
}
