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
};

export type FileSafetyResult = {
  safe: boolean;
  failures: string[];
};

export function validateFileSafety(input: FileSafetyInput, policy: FileSafetyPolicy): FileSafetyResult {
  const failures: string[] = [];
  if (!input.name.trim()) failures.push('file name is required');
  if (!Number.isInteger(input.bytes) || input.bytes < 1) failures.push('file size must be a positive integer');
  if (input.bytes > policy.maxBytes) failures.push('file exceeds the maximum size');
  if (!policy.allowedMime.includes(input.mime)) failures.push(`unsupported input MIME type: ${input.mime}`);

  if (input.width !== undefined || input.height !== undefined) {
    if (!Number.isInteger(input.width) || !input.width || input.width < 1) failures.push('width must be a positive integer');
    if (!Number.isInteger(input.height) || !input.height || input.height < 1) failures.push('height must be a positive integer');
    if (policy.maxPixels !== undefined && Number(input.width) * Number(input.height) > policy.maxPixels) {
      failures.push('input exceeds the maximum pixel count');
    }
  }

  if (policy.signatures && input.signature && !policy.signatures.some((signature) => input.signature!.startsWith(signature))) {
    failures.push('input signature does not match the allowed file signatures');
  }

  return { safe: failures.length === 0, failures };
}
