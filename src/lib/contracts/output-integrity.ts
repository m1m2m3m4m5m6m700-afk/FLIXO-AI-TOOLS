export type ArtifactSignature = string | { hex: string; offset?: number };

export type OutputIntegritySpec = {
  toolId: string;
  allowedMime: readonly string[];
  maxBytes: number;
  minBytes?: number;
  maxPixels?: number;
  allowedExtensions?: readonly string[];
  signatures?: readonly ArtifactSignature[];
  requireArtifact?: boolean;
  requireSafeFilename?: boolean;
  parseAs?: 'utf8' | 'json';
};

export type OutputIntegrityResult = {
  valid: boolean;
  failures: string[];
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
};

function normalizeExtension(filename?: string): string {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  return lastDot < 0 ? '' : filename.slice(lastDot + 1).trim().toLowerCase();
}

function normalizeSignature(signature: string): string {
  return signature.replace(/\s+/g, '').toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function signatureMatches(content: Uint8Array, signature: ArtifactSignature): boolean {
  const expected = typeof signature === 'string' ? normalizeSignature(signature) : normalizeSignature(signature.hex);
  const offset = typeof signature === 'string' ? 0 : signature.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) return false;
  const actual = bytesToHex(content.slice(offset, offset + expected.length / 2));
  return actual === expected;
}

function hasSafeFilename(filename?: string): boolean {
  if (!filename || filename === '.' || filename === '..') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('\0')) return false;
  return filename.trim() === filename;
}

function validateParseability(content: Uint8Array, parseAs?: 'utf8' | 'json'): string | undefined {
  if (!parseAs) return undefined;
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    return 'output content is not valid UTF-8';
  }
  if (parseAs === 'json') {
    try {
      JSON.parse(decoded);
    } catch {
      return 'output JSON content is malformed';
    }
  }
  return undefined;
}

export function validateOutputIntegrity(
  bytes: number,
  mime: string,
  spec: OutputIntegritySpec,
  dimensions?: { width: number; height: number },
  artifact?: { filename?: string; bytes?: Uint8Array },
): OutputIntegrityResult {
  const failures: string[] = [];
  const artifactRequired = spec.requireArtifact === true || Boolean(spec.allowedExtensions) || Boolean(spec.signatures) || Boolean(spec.parseAs);

  if (!Number.isInteger(bytes) || bytes < 1) failures.push('bytes must be a positive integer');
  if (spec.minBytes !== undefined && bytes < spec.minBytes) failures.push('output is smaller than the minimum size');
  if (bytes > spec.maxBytes) failures.push('output exceeds the maximum size');
  if (!spec.allowedMime.includes(mime)) failures.push(`unsupported output MIME type: ${mime}`);

  if (artifactRequired && !artifact) {
    failures.push('artifact bytes and filename are required for artifact integrity validation');
  }

  if (spec.requireSafeFilename || spec.allowedExtensions) {
    if (!hasSafeFilename(artifact?.filename)) {
      failures.push('output filename must be a single safe relative filename');
    }
  }

  if (spec.allowedExtensions) {
    const extension = normalizeExtension(artifact?.filename);
    if (!extension || !spec.allowedExtensions.includes(extension)) {
      failures.push(`unsupported output extension: ${extension || '(none)'}`);
    }
  }

  if (artifact?.bytes && artifact.bytes.byteLength !== bytes) {
    failures.push('declared output size does not match artifact byte length');
  }

  if (spec.signatures) {
    if (!artifact?.bytes) {
      failures.push('output signature bytes are required when signature validation is enabled');
    } else if (!spec.signatures.some((signature) => signatureMatches(artifact.bytes!, signature))) {
      failures.push('output signature does not match the allowed file signatures');
    }
  }

  if (artifact?.bytes) {
    const parseFailure = validateParseability(artifact.bytes, spec.parseAs);
    if (parseFailure) failures.push(parseFailure);
  }

  if (dimensions) {
    if (!Number.isInteger(dimensions.width) || dimensions.width < 1) failures.push('width must be a positive integer');
    if (!Number.isInteger(dimensions.height) || dimensions.height < 1) failures.push('height must be a positive integer');
    if (spec.maxPixels !== undefined && dimensions.width * dimensions.height > spec.maxPixels) {
      failures.push('output exceeds the maximum pixel count');
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    mime,
    bytes,
    ...(dimensions ?? {}),
  };
}
