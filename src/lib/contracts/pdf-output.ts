import type { ToolOutputContract } from './tool-output';

export const pdfOutputContract = {
  toolId: 'pdf-output',
  variants: [
    {
      kind: 'pdf',
      outputMimeTypes: ['application/pdf'],
      allowedExtensions: ['pdf'],
      signatures: ['255044462d'],
      downloadRequired: true,
      minOutputBytes: 8,
      maxOutputBytes: 100 * 1024 * 1024,
    },
  ],
} as const satisfies ToolOutputContract;
