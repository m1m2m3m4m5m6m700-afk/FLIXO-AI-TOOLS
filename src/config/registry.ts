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

/**
 * Build the authoritative route index shared by runtime and validation layers.
 * Every canonical path and alias must be globally unique; collisions fail closed.
 */
export function createToolPathIndex(
  tools: readonly ToolConfig[],
): ReadonlyMap<string, ToolConfig> {
  const byPath = new Map<string, ToolConfig>();

  for (const tool of tools) {
    const routes = [tool.path, ...(tool.aliases ?? [])];
    for (const route of routes) {
      if (!route.trim()) throw new Error(`Tool route must not be empty: ${tool.id}`);
      const existing = byPath.get(route);
      if (existing) {
        throw new Error(
          `Duplicate tool route: ${route} (${existing.id} conflicts with ${tool.id})`,
        );
      }
      byPath.set(route, tool);
    }
  }

  return byPath;
}

function assertToolRegistryContract(tools: readonly ToolConfig[]): void {
  const ids = new Set<string>();

  for (const tool of tools) {
    if (ids.has(tool.id)) throw new Error(`Duplicate tool id: ${tool.id}`);
    if (!tool.id.trim()) throw new Error('Tool id must not be empty');
    if (!tool.title.trim()) throw new Error(`Tool title must not be empty: ${tool.id}`);
    if (!tool.path.startsWith('/en/')) throw new Error(`Tool path must start with /en/: ${tool.id}`);
    if (!tool.component) throw new Error(`Tool component is missing: ${tool.id}`);
    ids.add(tool.id);
  }

  createToolPathIndex(tools);
}

const ALL_TOOLS = TOOL_FAMILIES.flat();
assertToolRegistryContract(ALL_TOOLS);

export const TOOL_REGISTRY: readonly ToolConfig[] = Object.freeze(ALL_TOOLS);
export const TOOL_DEFINITIONS = TOOL_REGISTRY;
export { AI_TOOLS, AUDIO_TOOLS, IMAGE_TOOLS, OTHER_TOOLS, PDF_TOOLS, VIDEO_TOOLS };
