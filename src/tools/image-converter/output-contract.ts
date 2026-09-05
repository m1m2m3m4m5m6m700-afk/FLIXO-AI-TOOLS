import type { ToolOutputContract } from '../../lib/contracts/tool-output';

export const imageConverterOutputContract = {
  toolId: 'image-converter',
  variants: [
    {
      kind: 'image',
      outputMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      signatures: ['ffd8ff', '89504e470d0a1a0a', '52494646'],
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
