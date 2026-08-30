import type { ToolOutputContract } from '../../lib/contracts/tool-output';

export const watermarkAdderOutputContract = {
  toolId: 'watermark-adder',
  variants: [
    {
      kind: 'image',
      outputMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
      signatures: ['89504e470d0a1a0a', 'ffd8ff', '52494646'],
      downloadRequired: true,
      minOutputBytes: 1,
      maxOutputBytes: 50 * 1024 * 1024,
      maxPixels: 100_000_000,
      validateSignature: true,
      validateDecode: true,
      validateDimensions: true,
    },
  ],
} as const satisfies ToolOutputContract;
