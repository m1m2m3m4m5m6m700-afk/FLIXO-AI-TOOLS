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
  compressedBytes?: number;
  uncompressedBytes?: number;
  isSymlink?: boolean;
  nestedEntries?: readonly ArchiveEntry[];
};

export type ArchiveSafetyPolicy = {
  maxEntries: number;
  maxUncompressedBytes: number;
  maxDepth: number;
  maxCompressionRatio?: number;
};

export const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = Object.freeze({
  avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg',
  png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp', zip: 'application/zip', txt: 'text/plain', json: 'application/json',
});

const riffSignature = [0x52, 0x49, 0x46, 0x46];
const ftypSignature = [0x66, 0x74, 0x79, 0x70];

export const MAGIC_BYTE_SIGNATURES: Readonly<Record<string, MagicByteSignature>> = Object.freeze({
  png: { name: 'PNG', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpeg: { name: 'JPEG', bytes: [0xff, 0xd8, 0xff] },
  gif: { name: 'GIF', bytes: [0x47, 0x49, 0x46, 0x38] },
  bmp: { name: 'BMP', bytes: [0x42, 0x4d] },
  webp: { name: 'WEBP', bytes: riffSignature, segments: [{ bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }] },
  avif: { name: 'AVIF', bytes: ftypSignature, offset: 4 },
  zip: { name: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
});

function normalizeExtension(name: string): string { const lastDot = name.lastIndexOf('.'); return lastDot < 0 ? '' : name.slice(lastDot + 1).trim().toLowerCase(); }
function normalizeSignature(signature: string): string { return signature.replace(/\s+/g, '').toLowerCase(); }
function isUnsafeName(name: string): boolean {
  if (!name.trim() || /^[A-Za-z]:($|[\\/])/.test(name) || /^[/\\]/.test(name)) return true;
  if (Array.from(name).some((char) => { const code = char.codePointAt(0) ?? 0; return code <= 0x1f || code === 0x7f; })) return true;
  const segments = name.replace(/\\/g, '/').split('/');
  return segments.length !== 1 || segments.some((segment) => segment === '..' || segment === '.');
}

export function validateBoundaryConditions(name: string, bytes: number): string | undefined {
  if (bytes === 0) return 'File is empty (0 bytes).';
  if (!name) return 'Filename is empty.';
  if (name.length > 255) return 'Filename exceeds maximum length of 255 characters.';
  if (Array.from(name).length > 150) return 'Filename contains excessive character payload length.';
  return undefined;
}

export function detectZipBombRisk(compressedSize: number, uncompressedSize: number, maxCompressionRatio: number = 40): { isBomb: boolean; reason?: string } {
  if (!Number.isFinite(compressedSize) || !Number.isFinite(uncompressedSize) || !Number.isFinite(maxCompressionRatio)) return { isBomb: true, reason: 'Invalid ZIP bomb detection input.' };
  if (compressedSize <= 0 || uncompressedSize < 0 || maxCompressionRatio <= 0) return { isBomb: true, reason: 'Invalid ZIP bomb detection boundary values.' };
  const ratio = uncompressedSize / compressedSize;
  return ratio > maxCompressionRatio ? { isBomb: true, reason: `Potential ZIP bomb detected: Expansion ratio ${ratio.toFixed(1)}x exceeds ${maxCompressionRatio}x.` } : { isBomb: false };
}

function matchesSegment(content: Uint8Array, segment: MagicByteSegment): boolean {
  if (!Number.isInteger(segment.offset) || segment.offset < 0 || content.length < segment.offset + segment.bytes.length) return false;
  return segment.bytes.every((expected, index) => content[segment.offset + index] === expected);
}
function matchesMagicBytes(content: Uint8Array, signature: MagicByteSignature): boolean {
  return matchesSegment(content, { bytes: signature.bytes, offset: signature.offset ?? 0 }) && (signature.segments ?? []).every((segment) => matchesSegment(content, segment));
}
export function verifyMagicBytesMatch(headerBytes: Uint8Array, allowedSignatures?: readonly string[]): boolean {
  if (!allowedSignatures?.length) return true;
  return allowedSignatures.some((name) => { const signature = MAGIC_BYTE_SIGNATURES[normalizeSignature(name)]; return signature ? matchesMagicBytes(headerBytes, signature) : false; });
}
function validateContent(content: Uint8Array, validation: ContentValidation, failures: string[]): void {
  try { const value = new TextDecoder('utf-8', { fatal: true }).decode(content).replace(/^\uFEFF/, ''); if (validation === 'json') JSON.parse(value); }
  catch { failures.push(validation === 'json' ? 'input JSON content is malformed' : 'input content is not valid UTF-8'); }
}

export function validateFileSafety(input: FileSafetyInput, policy: FileSafetyPolicy): FileSafetyResult {
  const failures: string[] = []; const name = input.name.trim(); const extension = normalizeExtension(name);
  const boundaryError = validateBoundaryConditions(name, input.bytes); if (boundaryError) failures.push(boundaryError);
  if (isUnsafeName(name)) failures.push('file name must be a single safe relative name');
  if (!Number.isInteger(input.bytes) || input.bytes < 1) failures.push('file size must be a positive integer');
  if (input.bytes > policy.maxBytes) failures.push('file exceeds the maximum size');
  if (!policy.allowedMime.includes(input.mime)) failures.push(`unsupported input MIME type: ${input.mime}`);
  if (input.content && input.content.byteLength !== input.bytes) failures.push('declared file size does not match input content length');
  if (policy.allowedExtensions) {
    if (!extension || !policy.allowedExtensions.includes(extension)) failures.push(`unsupported file extension: ${extension || '(none)'}`);
    const expectedMime = EXTENSION_MIME_MAP[extension]; if (expectedMime && expectedMime !== input.mime) failures.push(`file extension does not match MIME type: .${extension} -> ${input.mime}`);
  }
  if (input.width !== undefined || input.height !== undefined) {
    if (!Number.isInteger(input.width) || !input.width || input.width < 1) failures.push('width must be a positive integer');
    if (!Number.isInteger(input.height) || !input.height || input.height < 1) failures.push('height must be a positive integer');
    if (policy.maxPixels !== undefined && Number.isInteger(input.width) && Number.isInteger(input.height) && (input.width! * input.height!) > policy.maxPixels) failures.push('pixel count exceeds policy limit');
  }
  if (policy.signatures?.length && input.signature && !policy.signatures.some((allowed) => normalizeSignature(allowed) === normalizeSignature(input.signature!))) failures.push('file signature is not permitted by policy');
  if (policy.magicBytes?.length && input.content && !policy.magicBytes.some((signature) => matchesMagicBytes(input.content!, signature))) failures.push('file magic bytes do not match an allowed signature');
  if (policy.contentValidation && input.content) validateContent(input.content, policy.contentValidation, failures);
  return { safe: failures.length === 0, failures };
}

export function validateArchiveEntries(entries: readonly ArchiveEntry[], policy: ArchiveSafetyPolicy): FileSafetyResult {
  const failures: string[] = []; let totalBytes = 0; let totalEntries = 0;
  const visit = (items: readonly ArchiveEntry[], depth: number): void => {
    if (depth > policy.maxDepth) { failures.push(`archive nesting depth exceeds ${policy.maxDepth}`); return; }
    for (const entry of items) {
      totalEntries += 1;
      if (totalEntries > policy.maxEntries) { failures.push(`archive contains more than ${policy.maxEntries} entries`); return; }
      if (!entry.name || isUnsafeName(entry.name)) failures.push(`unsafe archive entry name: ${entry.name || '(empty)'}`);
      if (entry.isSymlink) failures.push(`symlink archive entry is not permitted: ${entry.name}`);
      const compressed = entry.compressedBytes ?? 0; const uncompressed = entry.uncompressedBytes ?? 0;
      if (compressed < 0 || uncompressed < 0) failures.push(`invalid archive size metadata: ${entry.name}`);
      totalBytes += uncompressed; if (totalBytes > policy.maxUncompressedBytes) failures.push('archive exceeds maximum uncompressed size');
      if (policy.maxCompressionRatio !== undefined && compressed > 0) { const bomb = detectZipBombRisk(compressed, uncompressed, policy.maxCompressionRatio); if (bomb.isBomb) failures.push(bomb.reason ?? 'archive compression ratio is unsafe'); }
      if (entry.nestedEntries?.length) visit(entry.nestedEntries, depth + 1);
    }
  };
  visit(entries, 0);
  return { safe: failures.length === 0, failures };
}
