export type OutputIntegritySpec = {
  toolId: string;
  allowedMime: readonly string[];
  maxBytes: number;
  minBytes?: number;
  maxPixels?: number;
  allowedExtensions?: readonly string[];
  signatures?: readonly string[];
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

export function validateOutputIntegrity(
  bytes: number,
  mime: string,
  spec: OutputIntegritySpec,
  dimensions?: { width: number; height: number },
  artifact?: { filename?: string; bytes?: Uint8Array },
): OutputIntegrityResult {
  const failures: string[] = [];

  if (!Number.isInteger(bytes) || bytes < 1) failures.push('bytes must be a positive integer');
  if (spec.minBytes !== undefined && bytes < spec.minBytes) failures.push('output is smaller than the minimum size');
  if (bytes > spec.maxBytes) failures.push('output exceeds the maximum size');
  if (!spec.allowedMime.includes(mime)) failures.push(`unsupported output MIME type: ${mime}`);

  if (spec.allowedExtensions) {
    const extension = normalizeExtension(artifact?.filename);
    if (!extension || !spec.allowedExtensions.includes(extension)) {
      failures.push(`unsupported output extension: ${extension || '(none)'}`);
    }
  }

  if (spec.signatures) {
    if (!artifact?.bytes) {
      failures.push('output signature bytes are required when signature validation is enabled');
    } else {
      const signature = bytesToHex(artifact.bytes);
      const normalizedSignatures = spec.signatures.map(normalizeSignature);
      if (!normalizedSignatures.some((allowed) => signature.startsWith(allowed))) {
        failures.push('output signature does not match the allowed file signatures');
      }
    }
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
