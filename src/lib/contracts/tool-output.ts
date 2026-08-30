export type ToolOutputKind = 'image' | 'svg' | 'pdf' | 'zip' | 'text' | 'json' | 'csv' | 'audio' | 'video';

export type ToolOutputVariant = {
  readonly kind: ToolOutputKind;
  readonly outputMimeTypes: readonly string[];
  readonly allowedExtensions: readonly string[];
  readonly signatures?: readonly string[];
  readonly downloadRequired: boolean;
  readonly minOutputBytes?: number;
  readonly maxOutputBytes?: number;
  readonly maxPixels?: number;
  readonly validateSignature?: boolean;
  readonly validateDecode?: boolean;
  readonly validateDimensions?: boolean;
  readonly parseAs?: 'utf8' | 'json';
};

export type ToolOutputContract = {
  readonly toolId: string;
  readonly variants: readonly ToolOutputVariant[];
};

export type ToolOutputResult = {
  readonly mimeType: string;
  readonly byteLength: number;
  readonly bytes?: Uint8Array;
  readonly filename?: string;
  readonly dimensions?: { readonly width: number; readonly height: number };
};

function extensionOf(filename?: string): string {
  if (!filename) return '';
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

function safeFilename(filename?: string): boolean {
  return Boolean(filename && filename === filename.trim() && filename !== '.' && filename !== '..' && !(/[\\/\0]/u.test(filename)));
}

function signatureMatches(bytes: Uint8Array, signature: string): boolean {
  const expected = signature.replace(/\s+/g, '').toLowerCase();
  const actual = Array.from(bytes.slice(0, expected.length / 2), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return actual === expected;
}

function assertVariant(variant: ToolOutputVariant, result: ToolOutputResult): void {
  if (!variant.outputMimeTypes.includes(result.mimeType)) throw new Error(`Unexpected MIME type for ${variant.kind}: ${result.mimeType}`);
  if (!Number.isInteger(result.byteLength) || result.byteLength < 1) throw new Error(`Output must be non-empty for ${variant.kind}`);
  if (variant.minOutputBytes !== undefined && result.byteLength < variant.minOutputBytes) throw new Error(`Output below minimum size for ${variant.kind}`);
  if (variant.maxOutputBytes !== undefined && result.byteLength > variant.maxOutputBytes) throw new Error(`Output above maximum size for ${variant.kind}`);
  if (variant.downloadRequired && !safeFilename(result.filename)) throw new Error(`Safe downloadable filename required for ${variant.kind}`);
  if (result.filename && variant.allowedExtensions.length && !variant.allowedExtensions.includes(extensionOf(result.filename))) throw new Error(`Unexpected extension for ${variant.kind}: ${extensionOf(result.filename)}`);
  if (variant.signatures?.length) {
    if (!result.bytes || !variant.signatures.some((signature) => signatureMatches(result.bytes!, signature))) throw new Error(`Invalid signature for ${variant.kind}`);
  }
  if (variant.validateDimensions && result.dimensions) {
    const { width, height } = result.dimensions;
    if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error(`Invalid dimensions for ${variant.kind}`);
    if (variant.maxPixels !== undefined && width * height > variant.maxPixels) throw new Error(`Pixel budget exceeded for ${variant.kind}`);
  }
  if (variant.parseAs && result.bytes) {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(result.bytes);
    if (variant.parseAs === 'json') JSON.parse(decoded);
  }
}

export function assertToolOutputContract(contract: ToolOutputContract, result: ToolOutputResult): void {
  const candidates = contract.variants.filter((variant) => variant.outputMimeTypes.includes(result.mimeType));
  if (!candidates.length) throw new Error(`No output contract variant matches ${contract.toolId}:${result.mimeType}`);
  const failures: string[] = [];
  for (const variant of candidates) {
    try {
      assertVariant(variant, result);
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`Output contract failed for ${contract.toolId}: ${failures.join('; ')}`);
}
