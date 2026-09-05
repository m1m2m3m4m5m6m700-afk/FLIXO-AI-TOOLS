import { AI_TOOLS } from './tool-definitions/ai.ts';
import { AUDIO_TOOLS } from './tool-definitions/audio.ts';
import { IMAGE_TOOLS } from './tool-definitions/image.ts';
import { OTHER_TOOLS } from './tool-definitions/other.ts';
import { PDF_TOOLS } from './tool-definitions/pdf.ts';
import type { ToolConfig } from './tool-definitions/types.ts';
import { VIDEO_TOOLS } from './tool-definitions/video.ts';

const TOOL_FAMILIES: readonly (readonly ToolConfig[])[] = [
  IMAGE_TOOLS,
  PDF_TOOLS,
  AUDIO_TOOLS,
  VIDEO_TOOLS,
  AI_TOOLS,
  OTHER_TOOLS,
];

function assertToolRegistryContract(tools: readonly ToolConfig[]): void {
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const tool of tools) {
    if (ids.has(tool.id)) throw new Error(`Duplicate tool id: ${tool.id}`);
    if (paths.has(tool.path)) throw new Error(`Duplicate tool path: ${tool.path}`);
    if (!tool.id.trim()) throw new Error('Tool id must not be empty');
    if (!tool.title.trim()) throw new Error(`Tool title must not be empty: ${tool.id}`);
    if (!tool.path.startsWith('/en/')) throw new Error(`Tool path must start with /en/: ${tool.id}`);
    if (!tool.component) throw new Error(`Tool component is missing: ${tool.id}`);
    ids.add(tool.id);
    paths.add(tool.path);
  }
}

const ALL_TOOLS = TOOL_FAMILIES.flat();
assertToolRegistryContract(ALL_TOOLS);

export const TOOL_REGISTRY: readonly ToolConfig[] = Object.freeze(ALL_TOOLS);
export const TOOL_DEFINITIONS = TOOL_REGISTRY;
export { AI_TOOLS, AUDIO_TOOLS, IMAGE_TOOLS, OTHER_TOOLS, PDF_TOOLS, VIDEO_TOOLS };
