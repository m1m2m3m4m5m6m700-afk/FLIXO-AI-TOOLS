import type { ToolOutputContract } from '../../lib/contracts/tool-output';

export const imageCompressorOutputContract = {
  toolId: 'image-compressor',
  variants: [
    {
      kind: 'image',
      outputMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      signatures: ['ffd8ff', '89504e470d0a1a0a', '52494646'],
      downloadRequired: true,
      minOutputBytes: 1,
      maxOutputBytes: 25 * 1024 * 1024,
      maxPixels: 40_000_000,
      validateSignature: true,
      validateDecode: true,
      validateDimensions: true,
    },
  ],
} as const satisfies ToolOutputContract;

export const imageCompressorOutputIntegrity = {
  toolId: 'image-compressor',
  allowedMime: imageCompressorOutputContract.variants[0].outputMimeTypes,
  allowedExtensions: imageCompressorOutputContract.variants[0].allowedExtensions,
  maxBytes: 25 * 1024 * 1024,
  minBytes: 1,
  maxPixels: 40_000_000,
  signatures: [...imageCompressorOutputContract.variants[0].signatures],
} as const;
