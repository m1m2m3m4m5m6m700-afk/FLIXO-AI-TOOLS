import { TOOL_REGISTRY } from '../../config/registry.ts';
import { imageCompressorOutputContract } from '../../tools/image-compressor/output-contract.ts';
import type { ToolOutputContract, ToolOutputVariant } from './tool-output';

const image: ToolOutputVariant = { kind: 'image', outputMimeTypes: ['image/png', 'image/jpeg', 'image/webp'], allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'], signatures: ['89504e470d0a1a0a', 'ffd8ff', '52494646'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 50 * 1024 * 1024, maxPixels: 100_000_000, validateDimensions: true };
const svg: ToolOutputVariant = { kind: 'svg', outputMimeTypes: ['image/svg+xml'], allowedExtensions: ['svg'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 10 * 1024 * 1024, parseAs: 'utf8' };
const text: ToolOutputVariant = { kind: 'text', outputMimeTypes: ['text/plain'], allowedExtensions: ['txt'], downloadRequired: true, minOutputBytes: 1, maxOutputBytes: 25 * 1024 * 1024, parseAs: 'utf8' };
const json: ToolOutputVariant = { kind: 'json', outputMimeTypes: ['application/json'], allowedExtensions: ['json'], downloadRequired: true, minOutputBytes: 2, maxOutputBytes: 25 * 1024 * 1024, parseAs: 'json' };

const contracts: Record<string, ToolOutputContract> = {
  'image-compressor': imageCompressorOutputContract,
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
  'collage-maker': { toolId: 'collage-maker', variants: [image] },
  'image-effects': { toolId: 'image-effects', variants: [image] },
  'exif-cleaner': { toolId: 'exif-cleaner', variants: [image] },
  'svg-optimizer': { toolId: 'svg-optimizer', variants: [svg] },
  'mockup-generator': { toolId: 'mockup-generator', variants: [image] },
  seed: { toolId: 'seed', variants: [image] },
  pix: { toolId: 'pix', variants: [image] },
  'ai-image-generator': { toolId: 'ai-image-generator', variants: [image] },
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
