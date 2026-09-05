import type { LocalizedToolSeo } from '@/lib/seo/tool-manifest';

export const en: LocalizedToolSeo = Object.freeze({
  title: 'Background Remover Online | FLIXO',
  description: 'Remove connected, uniform image backgrounds locally in your browser without uploading the image.',
  intro: 'FLIXO Background Remover helps you isolate a subject from a simple, connected background directly in your browser. The tool is designed for quick edits where the background has relatively consistent color or texture. Choose an image, let the browser process it locally, review the result, and download the output. Local processing keeps the source image in your browser instead of sending it to a FLIXO processing server.',
  keywords: ['background remover online', 'remove image background', 'transparent background', 'browser background remover'],
  howTo: ['Choose an image with a connected or uniform background.', 'Run the background removal and review the preview.', 'Download the processed image when the result looks correct.'],
  features: ['Browser-first local processing', 'Designed for connected uniform backgrounds', 'Preview before download', 'No server upload required for the local workflow'],
  altText: ['Background remover workspace', 'Original image before background removal', 'Processed image with background removed'],
});
