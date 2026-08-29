import type { ToolOutputContract } from '../../lib/contracts/tool-output';

export const imageCompressorOutputContract = {
  toolId: 'image-compressor',
  kind: 'image',
  outputMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  downloadRequired: true,
  minOutputBytes: 1,
  validateSignature: true,
  validateDecode: true,
  validateDimensions: true,
  validateMetadata: false,
} as const satisfies ToolOutputContract;

export const imageCompressorOutputIntegrity = {
  toolId: 'image-compressor',
  allowedMime: imageCompressorOutputContract.outputMimeTypes,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  maxBytes: 25 * 1024 * 1024,
  minBytes: imageCompressorOutputContract.minOutputBytes,
  maxPixels: 40_000_000,
  signatures: [
    'ffd8ff',
    '89504e470d0a1a0a',
    '52494646',
  ],
} as const;
