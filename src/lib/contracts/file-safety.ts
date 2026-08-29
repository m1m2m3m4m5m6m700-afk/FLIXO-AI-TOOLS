export type MagicByteSegment = {
  bytes: readonly number[];
  offset: number;
};

export type MagicByteSignature = {
  name: string;
  bytes: readonly number[];
  offset?: number;
  segments?: readonly MagicByteSegment[];
};

export type ContentValidation = 'utf8' | 'json';

export type FileSafetyInput = {
  name: string;
  mime: string;
  bytes: number;
  signature?: string;
  content?: Uint8Array;
  width?: number;
  height?: number;
};

export type FileSafetyPolicy = {
  allowedMime: readonly string[];
  maxBytes: number;
  maxPixels?: number;
  signatures?: readonly string[];
  magicBytes?: readonly MagicByteSignature[];
  contentValidation?: ContentValidation;
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

const riffSignature = [0x52, 0x49, 0x46, 0x46];
const ftypSignature = [0x66, 0x74, 0x79, 0x70];

export const MAGIC_BYTE_SIGNATURES: Readonly<Record<string, MagicByteSignature>> = Object.freeze({
  png: { name: 'PNG', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpeg: { name: 'JPEG', bytes: [0xff, 0xd8, 0xff] },
  gif: { name: 'GIF', bytes: [0x47, 0x49, 0x46, 0x38] },
  bmp: { name: 'BMP', bytes: [0x42, 0x4d] },
  pdf: { name: 'PDF', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  zip: { name: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
  ogg: { name: 'OggS', bytes: [0x4f, 0x67, 0x67, 0x53] },
  flac: { name: 'FLAC', bytes: [0x66, 0x4c, 0x61, 0x43] },
  mp3: { name: 'ID3/MP3', bytes: [0x49, 0x44, 0x33] },
  aac: { name: 'AAC', bytes: [0xff, 0xf1] },
  webp: {
    name: 'WEBP',
    bytes: riffSignature,
    segments: [{ bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }],
  },
  wav: {
    name: 'WAV',
    bytes: riffSignature,
    segments: [{ bytes: [0x57, 0x41, 0x56, 0x45], offset: 8 }],
  },
  avi: {
    name: 'AVI',
    bytes: riffSignature,
    segments: [{ bytes: [0x41, 0x56, 0x49, 0x20], offset: 8 }],
  },
  mp4: { name: 'ISO-BMFF', bytes: ftypSignature, offset: 4 },
  mov: { name: 'ISO-BMFF', bytes: ftypSignature, offset: 4 },
  m4a: { name: 'ISO-BMFF', bytes: ftypSignature, offset: 4 },
  avif: { name: 'ISO-BMFF', bytes: ftypSignature, offset: 4 },
  webm: { name: 'WebM/EBML', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
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
  if (Array.from(name).some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return (code >= 0 && code <= 0x1f) || code === 0x7f;
  })) return true;
  const normalized = name.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments.some((segment) => segment === '..' || segment === '.') || segments.length !== 1;
}

function matchesSegment(content: Uint8Array, segment: MagicByteSegment): boolean {
  if (segment.offset < 0 || content.length < segment.offset + segment.bytes.length) return false;
  return segment.bytes.every((expected, index) => content[segment.offset + index] === expected);
}

function matchesMagicBytes(content: Uint8Array, signature: MagicByteSignature): boolean {
  const primary: MagicByteSegment = { bytes: signature.bytes, offset: signature.offset ?? 0 };
  return matchesSegment(content, primary)
    && (signature.segments ?? []).every((segment) => matchesSegment(content, segment));
}

function validateContent(content: Uint8Array, validation: ContentValidation, failures: string[]): void {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(content).replace(/^\uFEFF/, '');
  } catch {
    failures.push('input content is not valid UTF-8');
    return;
  }

  if (validation === 'json') {
    try {
      JSON.parse(text);
    } catch {
      failures.push('input JSON content is malformed');
    }
  }
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

  if (input.content && input.content.byteLength !== input.bytes) {
    failures.push('declared file size does not match input content length');
  }

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

  if (policy.magicBytes) {
    if (!input.content) {
      failures.push('input content bytes are required when magic-byte validation is enabled');
    } else if (!policy.magicBytes.some((allowed) => matchesMagicBytes(input.content!, allowed))) {
      failures.push('input magic bytes do not match the allowed file signatures');
    }
  }

  if (policy.contentValidation) {
    if (!input.content) {
      failures.push('input content bytes are required when content validation is enabled');
    } else if (input.content.byteLength > 0) {
      validateContent(input.content, policy.contentValidation, failures);
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
