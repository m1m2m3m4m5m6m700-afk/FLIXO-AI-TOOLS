import { TOOL_DEFINITIONS, type ToolDefinition } from '../canonical-tool-definition.ts';
import { createToolCatalog } from './catalog.ts';
import type { ToolCatalog } from './types.ts';

export const REGISTERED_TOOL_DEFINITIONS: readonly ToolDefinition[] = TOOL_DEFINITIONS;
export const TOOL_CATALOG: ToolCatalog = createToolCatalog(REGISTERED_TOOL_DEFINITIONS);

export function getRegisteredToolDefinitions(): readonly ToolDefinition[] {
  return REGISTERED_TOOL_DEFINITIONS;
}

export function getLoadedToolCatalog(): ToolCatalog {
  return TOOL_CATALOG;
}
