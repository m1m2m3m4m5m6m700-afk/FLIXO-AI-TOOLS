import type { ToolDefinition } from '../config/canonical-tool-definition';
import type { ToolCard } from '../components/ar-home-tools-section';
export function recommendImageTool(
  file: File,
  readyTools: readonly ToolDefinition[],
  localize: (tool: ToolDefinition) => ToolCard,
): ToolCard | null {
  if (!file.type.startsWith('image/')) return null;

  const lower = file.name.toLowerCase();
  const imageTool = readyTools.find((tool) => tool.id === 'image-compressor');
  const ocrTool = readyTools.find((tool) => tool.id === 'image-ocr');
  const match = /ocr|text|scan/.test(lower) ? ocrTool ?? imageTool : imageTool;

  return match ? localize(match) : null;
}
