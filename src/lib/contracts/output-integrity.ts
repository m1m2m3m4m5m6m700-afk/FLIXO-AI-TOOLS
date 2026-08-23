export type OutputIntegritySpec = {
  toolId: string;
  allowedMime: readonly string[];
  maxBytes: number;
  minBytes?: number;
  maxPixels?: number;
};

export type OutputIntegrityResult = {
  valid: boolean;
  failures: string[];
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
};

export function validateOutputIntegrity(
  bytes: number,
  mime: string,
  spec: OutputIntegritySpec,
  dimensions?: { width: number; height: number },
): OutputIntegrityResult {
  const failures: string[] = [];

  if (!Number.isInteger(bytes) || bytes < 0) failures.push('bytes must be a non-negative integer');
  if (spec.minBytes !== undefined && bytes < spec.minBytes) failures.push('output is smaller than the minimum size');
  if (bytes > spec.maxBytes) failures.push('output exceeds the maximum size');
  if (!spec.allowedMime.includes(mime)) failures.push(`unsupported output MIME type: ${mime}`);

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
