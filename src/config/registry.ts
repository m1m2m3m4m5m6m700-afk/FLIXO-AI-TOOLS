import { IMAGE_TOOLS } from './tool-definitions/image.ts';
import type { ToolConfig } from './tool-definitions/types.ts';
import { createToolCatalog } from './tool-platform/catalog.ts';
import type { ToolCatalog } from './tool-platform/types.ts';

const TOOL_FAMILIES: readonly (readonly ToolConfig[])[] = [IMAGE_TOOLS];

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
    if (tool.category !== 'Images') throw new Error(`Non-image tool family/category detected: ${tool.id}`);
    ids.add(tool.id);
    paths.add(tool.path);
  }
}

const ALL_TOOLS = TOOL_FAMILIES.flat();
assertToolRegistryContract(ALL_TOOLS);

export const TOOL_REGISTRY: readonly ToolConfig[] = Object.freeze(ALL_TOOLS);
export const TOOL_CATALOG: ToolCatalog = createToolCatalog(TOOL_REGISTRY);
export const TOOL_DEFINITIONS = TOOL_REGISTRY;
export { IMAGE_TOOLS };

export function getToolById(id: string) {
  return TOOL_CATALOG.byId.get(id);
}

export function getToolByRoute(path: string) {
  return TOOL_CATALOG.byPath.get(path) ?? TOOL_CATALOG.byAlias.get(path);
}
