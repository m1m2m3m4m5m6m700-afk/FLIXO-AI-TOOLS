export type ImageDiagnostic = {
  ok: boolean;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  issues: string[];
};

export async function diagnoseImageBlob(
  blob: Blob,
  expectedMimeTypes: readonly string[] = [],
  maxBytes?: number,
): Promise<ImageDiagnostic> {
  const issues: string[] = [];

  if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(blob.type)) {
    issues.push(`Unexpected MIME type: ${blob.type || 'unknown'}`);
  }

  if (maxBytes !== undefined && blob.size > maxBytes) {
    issues.push(`Output exceeds limit: ${blob.size} > ${maxBytes} bytes`);
  }

  let width = 0;
  let height = 0;

  try {
    const bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch {
    issues.push('Output cannot be decoded as an image');
  }

  if (width < 1 || height < 1) {
    issues.push('Output has invalid dimensions');
  }

  return {
    ok: issues.length === 0,
    mimeType: blob.type,
    sizeBytes: blob.size,
    width,
    height,
    issues,
  };
}
