import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { CANONICAL_LOCALES, failValidation } from './validation-utils.mjs';

const locales = CANONICAL_LOCALES;
const completeTools = [
  'background-remover',
  'image-compressor',
  'image-converter',
  'image-cropper',
  'exif-cleaner',
  'background-blur',
];

const toolsById = new Map(TOOL_MANIFEST.map((tool) => [tool.id, tool]));

for (const toolId of completeTools) {
  const tool = toolsById.get(toolId);
  if (!tool) failValidation(`${toolId} is missing from central TOOL_MANIFEST`);
  if (!tool.isReady) failValidation(`${toolId} must be ready for the full localization gate`);

  for (const locale of locales) {
    const localized = tool.seoByLocale?.[locale];
    if (!localized?.title?.trim()) failValidation(`${toolId} is missing localized SEO title for ${locale}`);
  }
}

console.log(`Full localization gate passed: ${completeTools.length} tools × ${locales.length} locales via central TOOL_MANIFEST.`);
