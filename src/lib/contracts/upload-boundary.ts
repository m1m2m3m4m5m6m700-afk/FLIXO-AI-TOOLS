import { validateFileSafety, type FileSafetyPolicy, type FileSafetyResult } from './file-safety.ts';

export type UploadBoundaryPolicy = FileSafetyPolicy & {
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

function bytesToHex(bytes: Uint8Array, limit = 16): string {
  return Array.from(bytes.slice(0, limit), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function validateUploadBoundary(
  input: UploadBoundaryInput,
  policy: UploadBoundaryPolicy,
): UploadBoundaryResult {
  const signature = bytesToHex(input.bytes);
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

  return { ...safety, signature };
}
