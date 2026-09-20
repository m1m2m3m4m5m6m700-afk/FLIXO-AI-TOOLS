import type { ToolOutputContract } from '../../lib/contracts/tool-output';

export const imageToSvgOutputContract = {
  toolId: 'image-to-svg',
  variants: [
    {
      kind: 'svg',
      outputMimeTypes: ['image/svg+xml'],
      allowedExtensions: ['svg'],
      downloadRequired: true,
      minOutputBytes: 1,
      maxOutputBytes: 10 * 1024 * 1024,
      parseAs: 'utf8',
    },
  ],
} as const satisfies ToolOutputContract;
