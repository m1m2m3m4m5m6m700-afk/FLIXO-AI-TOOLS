import { TOOL_REGISTRY } from '../../config/registry.ts';
import type { ToolOutputContract, ToolOutputVariant } from './tool-output';

const image: ToolOutputVariant = { kind: 'image', outputMimeTypes: ['image/png', 'image/jpeg', 'image/webp'], allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'], signatures: ['89504e470d0a1a0a', 'ffd8ff', '52494646'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 50 * 1024 * 1024, maxPixels: 100_000_000, validateDimensions: true };
const svg: ToolOutputVariant = { kind: 'svg', outputMimeTypes: ['image/svg+xml'], allowedExtensions: ['svg'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 10 * 1024 * 1024, parseAs: 'utf8' };
const pdf: ToolOutputVariant = { kind: 'pdf', outputMimeTypes: ['application/pdf'], allowedExtensions: ['pdf'], signatures: ['25504446'], downloadRequired: true, minOutputBytes: 5, maxOutputBytes: 100 * 1024 * 1024 };
const zip: ToolOutputVariant = { kind: 'zip', outputMimeTypes: ['application/zip'], allowedExtensions: ['zip'], signatures: ['504b0304', '504b0506', '504b0708'], downloadRequired: true, minOutputBytes: 22, maxOutputBytes: 100 * 1024 * 1024 };
const text: ToolOutputVariant = { kind: 'text', outputMimeTypes: ['text/plain'], allowedExtensions: ['txt'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 25 * 1024 * 1024, parseAs: 'utf8' };
const json: ToolOutputVariant = { kind: 'json', outputMimeTypes: ['application/json'], allowedExtensions: ['json'], downloadRequired: true, minOutputBytes: 2, maxOutputBytes: 25 * 1024 * 1024, parseAs: 'json' };
const csv: ToolOutputVariant = { kind: 'csv', outputMimeTypes: ['text/csv'], allowedExtensions: ['csv'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 25 * 1024 * 1024, parseAs: 'utf8' };
const audio: ToolOutputVariant = { kind: 'audio', outputMimeTypes: ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/ogg'], allowedExtensions: ['webm', 'wav', 'mp3', 'ogg'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 200 * 1024 * 1024 };
const video: ToolOutputVariant = { kind: 'video', outputMimeTypes: ['video/webm', 'video/mp4', 'image/gif'], allowedExtensions: ['webm', 'mp4', 'gif'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 500 * 1024 * 1024 };
const caption: ToolOutputVariant = { kind: 'text', outputMimeTypes: ['text/plain', 'application/x-subrip', 'text/vtt'], allowedExtensions: ['txt', 'srt', 'vtt'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 25 * 1024 * 1024, parseAs: 'utf8' };

const contracts: Record<string, ToolOutputContract> = {
  'image-compressor': { toolId: 'image-compressor', variants: [image] },
  'background-remover': { toolId: 'background-remover', variants: [image] },
  'image-upscaler': { toolId: 'image-upscaler', variants: [image] },
  'image-converter': { toolId: 'image-converter', variants: [image, svg] },
  'object-remover': { toolId: 'object-remover', variants: [image] },
  'watermark-remover': { toolId: 'watermark-remover', variants: [image] },
  'image-cropper': { toolId: 'image-cropper', variants: [image] },
  'image-to-svg': { toolId: 'image-to-svg', variants: [svg] },
  'image-ocr': { toolId: 'image-ocr', variants: [text, json] },
  'background-blur': { toolId: 'background-blur', variants: [image] },
  'passport-photo-maker': { toolId: 'passport-photo-maker', variants: [image] },
  'watermark-adder': { toolId: 'watermark-adder', variants: [image] },
  'meme-generator': { toolId: 'meme-generator', variants: [image] },
  'collage-maker': { toolId: 'collage-maker', variants: [image, zip] },
  'image-effects': { toolId: 'image-effects', variants: [image] },
  'exif-cleaner': { toolId: 'exif-cleaner', variants: [image] },
  'svg-optimizer': { toolId: 'svg-optimizer', variants: [svg] },
  'mockup-generator': { toolId: 'mockup-generator', variants: [image] },
  seed: { toolId: 'seed', variants: [image] },
  pix: { toolId: 'pix', variants: [image] },
  'pdf-merger-splitter': { toolId: 'pdf-merger-splitter', variants: [pdf, zip] },
  'pdf-compressor': { toolId: 'pdf-compressor', variants: [pdf] },
  'image-to-pdf': { toolId: 'image-to-pdf', variants: [pdf] },
  'pdf-unlock-protect': { toolId: 'pdf-unlock-protect', variants: [pdf] },
  'pdf-to-text': { toolId: 'pdf-to-text', variants: [text, json] },
  'audio-extractor-muter': { toolId: 'audio-extractor-muter', variants: [audio, video] },
  'audio-cutter-trimmer': { toolId: 'audio-cutter-trimmer', variants: [audio] },
  'audio-compressor': { toolId: 'audio-compressor', variants: [audio] },
  'audio-noise-reducer': { toolId: 'audio-noise-reducer', variants: [audio] },
  'video-trimmer-splitter': { toolId: 'video-trimmer-splitter', variants: [video] },
  'video-gif-meme': { toolId: 'video-gif-meme', variants: [video] },
  'video-compressor-converter': { toolId: 'video-compressor-converter', variants: [video] },
  'ai-captioner-srt': { toolId: 'ai-captioner-srt', variants: [caption] },
  'ai-vocal-instrumental-remover': { toolId: 'ai-vocal-instrumental-remover', variants: [audio] },
  'ai-image-generator': { toolId: 'ai-image-generator', variants: [image] },
  'word-character-counter': { toolId: 'word-character-counter', variants: [text, json] },
  'text-diff-checker': { toolId: 'text-diff-checker', variants: [text] },
  'case-converter': { toolId: 'case-converter', variants: [text] },
  'qr-generator-reader': { toolId: 'qr-generator-reader', variants: [image, text] },
  'password-generator': { toolId: 'password-generator', variants: [text] },
  'aspect-ratio-calculator': { toolId: 'aspect-ratio-calculator', variants: [json] },
  'json-formatter-validator': { toolId: 'json-formatter-validator', variants: [json] },
  'base64-encoder-decoder': { toolId: 'base64-encoder-decoder', variants: [text] },
  'color-picker-palette': { toolId: 'color-picker-palette', variants: [text, json, csv] },
  'regex-tester': { toolId: 'regex-tester', variants: [text] },
  'hash-generator': { toolId: 'hash-generator', variants: [text] },
};

export const TOOL_OUTPUT_CONTRACTS: Readonly<Record<string, ToolOutputContract>> = Object.freeze(contracts);

export function getToolOutputContract(toolId: string): ToolOutputContract | undefined {
  return TOOL_OUTPUT_CONTRACTS[toolId];
}

export function assertReadyToolsHaveOutputContracts(): void {
  const ready = TOOL_REGISTRY.filter((tool) => tool.isReady);
  const readyIds = new Set(ready.map((tool) => tool.id));
  const contractIds = new Set(Object.keys(TOOL_OUTPUT_CONTRACTS));
  const missing = ready.filter((tool) => !contractIds.has(tool.id)).map((tool) => tool.id);
  const orphan = [...contractIds].filter((id) => !readyIds.has(id));
  if (missing.length) throw new Error(`Ready tools missing output contracts: ${missing.join(', ')}`);
  if (orphan.length) throw new Error(`Output contracts reference non-ready/unknown tools: ${orphan.join(', ')}`);
  if (contractIds.size !== readyIds.size) throw new Error(`Output contract parity mismatch: contracts=${contractIds.size}, ready=${readyIds.size}`);
  for (const contract of Object.values(TOOL_OUTPUT_CONTRACTS)) {
    if (!contract.variants.length) throw new Error(`Output contract has no variants: ${contract.toolId}`);
    for (const variant of contract.variants) {
      if (!variant.outputMimeTypes.length || !variant.allowedExtensions.length) throw new Error(`Output contract variant is incomplete: ${contract.toolId}/${variant.kind}`);
      if (variant.maxOutputBytes !== undefined && variant.minOutputBytes !== undefined && variant.maxOutputBytes < variant.minOutputBytes) throw new Error(`Invalid byte bounds: ${contract.toolId}/${variant.kind}`);
    }
  }
}
