type ReadyTool = {
  id: string;
  title: string;
  description: string;
  category: 'Images' | 'AI' | 'Other';
  path: string;
};

type ToolCard = {
  title: string;
  description: string;
  category: 'Images' | 'AI' | 'Other';
  path: string;
};

export function recommendImageTool(
  file: File,
  readyTools: readonly ReadyTool[],
  localize: (tool: ReadyTool) => ToolCard,
): ToolCard | null {
  if (!file.type.startsWith('image/')) return null;

  const lower = file.name.toLowerCase();
  const imageTool = readyTools.find((tool) => tool.id === 'image-compressor');
  const ocrTool = readyTools.find((tool) => tool.id === 'image-ocr');
  const match = /ocr|text|scan/.test(lower) ? ocrTool ?? imageTool : imageTool;

  return match ? localize(match) : null;
}
