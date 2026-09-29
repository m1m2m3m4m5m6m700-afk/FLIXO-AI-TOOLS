import type { ToolOutputContract } from '../../lib/contracts/tool-output';

export const exifCleanerOutputContract = {
  toolId: 'exif-cleaner',
  variants: [
    {
      kind: 'image',
      outputMimeTypes: ['image/png'],
      allowedExtensions: ['png'],
      signatures: ['89504e470d0a1a0a'],
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
