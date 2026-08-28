import type { ToolConfig } from './tool-definitions/types.ts';

export type ToolRelations = Readonly<{
  relatedToolIds: readonly string[];
  prerequisiteToolIds: readonly string[];
}>;

const RELATIONS: Readonly<Record<string, ToolRelations>> = Object.freeze({
  'image-compressor': { relatedToolIds: ['image-converter', 'image-cropper', 'image-upscaler', 'exif-cleaner'], prerequisiteToolIds: [] },
  'image-converter': { relatedToolIds: ['image-compressor', 'image-cropper', 'image-to-svg', 'image-ocr'], prerequisiteToolIds: [] },
  'image-cropper': { relatedToolIds: ['image-compressor', 'image-converter', 'passport-photo-maker', 'watermark-adder'], prerequisiteToolIds: [] },
  'image-ocr': { relatedToolIds: ['image-to-pdf', 'image-converter', 'image-compressor'], prerequisiteToolIds: [] },
  'image-to-svg': { relatedToolIds: ['image-converter', 'svg-optimizer', 'image-compressor'], prerequisiteToolIds: [] },
  'watermark-adder': { relatedToolIds: ['image-cropper', 'image-compressor', 'image-converter'], prerequisiteToolIds: [] },
  'exif-cleaner': { relatedToolIds: ['image-compressor', 'image-converter', 'image-to-svg'], prerequisiteToolIds: [] },
  'pdf-merger-splitter': { relatedToolIds: ['pdf-compressor', 'image-to-pdf', 'pdf-to-text', 'pdf-unlock-protect'], prerequisiteToolIds: [] },
  'image-to-pdf': { relatedToolIds: ['image-ocr', 'pdf-compressor', 'pdf-merger-splitter'], prerequisiteToolIds: ['image-converter'] },
  'pdf-compressor': { relatedToolIds: ['pdf-merger-splitter', 'image-to-pdf', 'pdf-to-text'], prerequisiteToolIds: [] },
  'pdf-to-text': { relatedToolIds: ['image-ocr', 'pdf-compressor', 'pdf-merger-splitter'], prerequisiteToolIds: [] },
  'audio-cutter-trimmer': { relatedToolIds: ['audio-compressor', 'audio-noise-reducer', 'audio-extractor-muter'], prerequisiteToolIds: [] },
  'audio-compressor': { relatedToolIds: ['audio-cutter-trimmer', 'audio-noise-reducer', 'audio-extractor-muter'], prerequisiteToolIds: [] },
  'audio-noise-reducer': { relatedToolIds: ['audio-cutter-trimmer', 'audio-compressor'], prerequisiteToolIds: [] },
  'audio-extractor-muter': { relatedToolIds: ['audio-cutter-trimmer', 'audio-compressor', 'audio-noise-reducer'], prerequisiteToolIds: [] },
});

export function getToolRelations(tool: ToolConfig): ToolRelations {
  const explicit = RELATIONS[tool.id];
  if (explicit) return explicit;

  const sameCategory = [] as string[];
  return { relatedToolIds: sameCategory, prerequisiteToolIds: [] };
}
