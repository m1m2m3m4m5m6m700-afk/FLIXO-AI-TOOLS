import { TOOL_DEFINITIONS } from './canonical-tool-definition.ts';
import type { ToolDefinition } from './canonical-tool-definition.ts';
import { getLoadedToolCatalog } from './tool-platform/loader.ts';
import type { ToolCatalog } from './tool-platform/types.ts';

function assertToolRegistryContract(tools: readonly ToolDefinition[]): void {
  const ids = new Set<string>();
  const routes = new Set<string>();

  for (const tool of tools) {
    if (ids.has(tool.id)) throw new Error(`Duplicate tool id: ${tool.id}`);
    if (routes.has(tool.path)) throw new Error(`Duplicate tool path: ${tool.id}`);
    if (!tool.id.trim()) throw new Error('Tool id must not be empty');
    if (!tool.title.trim()) throw new Error(`Tool title must not be empty: ${tool.id}`);
    if (!tool.path.startsWith('/en/')) throw new Error(`Tool path must start with /en/: ${tool.id}`);
    if (!Object.keys(tool.routes).length) throw new Error(`Localized routes are missing: ${tool.id}`);
    if (!tool.component) throw new Error(`Tool component is missing: ${tool.id}`);
    if (!tool.parameterSchema) throw new Error(`Capability parameter schema is missing: ${tool.id}`);
    if (!tool.verifier) throw new Error(`Capability verifier is missing: ${tool.id}`);
    if (!tool.recovery) throw new Error(`Recovery policy is missing: ${tool.id}`);
    if (tool.recovery.maxAttempts < 0) throw new Error(`Invalid recovery attempt budget: ${tool.id}`);
    if (!tool.operational.executorId && tool.capability.state === 'EXECUTABLE') throw new Error(`Executable tool has no executor binding: ${tool.id}`);
    if (tool.isReady && tool.operational.outputContractId !== tool.id) throw new Error(`Ready tool output contract binding is missing: ${tool.id}`);
    for (const alias of tool.aliases) {
      if (routes.has(alias) || alias === tool.path) throw new Error(`Duplicate tool route alias: ${tool.id}:${alias}`);
      routes.add(alias);
    }
    ids.add(tool.id);
    routes.add(tool.path);
  }
}

assertToolRegistryContract(TOOL_DEFINITIONS);

export const TOOL_REGISTRY: readonly ToolDefinition[] = Object.freeze(TOOL_DEFINITIONS);
export const TOOL_CATALOG: ToolCatalog = getLoadedToolCatalog();

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOL_CATALOG.byId.get(id);
}

export function getToolByRoute(path: string): ToolDefinition | undefined {
  return TOOL_CATALOG.byPath.get(path) ?? TOOL_CATALOG.byAlias.get(path);
}

export { TOOL_DEFINITIONS };
