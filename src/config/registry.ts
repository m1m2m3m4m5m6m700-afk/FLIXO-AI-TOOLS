import { TOOL_DEFINITIONS } from './canonical-tool-definition.ts';
import type { ToolDefinition } from './canonical-tool-definition.ts';
import { IMAGE_TOOLS } from './tool-definitions/image.ts';
import { createToolCatalog } from './tool-platform/catalog.ts';
import type { ToolCatalog } from './tool-platform/types.ts';

function assertToolRegistryContract(tools: readonly ToolDefinition[]): void {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const tool of tools) {
    if (ids.has(tool.id)) throw new Error(`Duplicate tool id: ${tool.id}`);
    if (paths.has(tool.path)) throw new Error(`Duplicate tool path: ${tool.id}`);
    if (!tool.id.trim()) throw new Error('Tool id must not be empty');
    if (!tool.title.trim()) throw new Error(`Tool title must not be empty: ${tool.id}`);
    if (!tool.path.startsWith('/en/')) throw new Error(`Tool path must start with /en/: ${tool.id}`);
    if (Object.keys(tool.routes).length === 0) throw new Error(`Localized routes are missing: ${tool.id}`);
    if (!tool.component) throw new Error(`Tool component is missing: ${tool.id}`);
    if (!tool.parameterSchema) throw new Error(`Capability parameter schema is missing: ${tool.id}`);
    if (!tool.verifier) throw new Error(`Capability verifier is missing: ${tool.id}`);
    if (!tool.localization.titleKey || !tool.localization.descriptionKey) throw new Error(`Localization keys are missing: ${tool.id}`);
    if (!tool.seo.title || !tool.seo.description) throw new Error(`SEO metadata is missing: ${tool.id}`);
    ids.add(tool.id);
    paths.add(tool.path);
  }
}

assertToolRegistryContract(TOOL_DEFINITIONS);

export const TOOL_REGISTRY: readonly ToolDefinition[] = Object.freeze(TOOL_DEFINITIONS);
export const TOOL_CATALOG: ToolCatalog = createToolCatalog(TOOL_REGISTRY);
export { TOOL_DEFINITIONS, IMAGE_TOOLS };

export function getToolById(id: string) {
  return TOOL_CATALOG.byId.get(id);
}

export function getToolByRoute(path: string) {
  return TOOL_CATALOG.byPath.get(path) ?? TOOL_CATALOG.byAlias.get(path);
}
