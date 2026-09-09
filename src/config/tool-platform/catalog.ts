import type { ToolConfig } from '../tool-definitions/types.ts';
import type { ManagedTool, ToolCatalog, ToolContractLevel, ToolExecution, ToolLifecycle } from './types.ts';

const DEFAULT_FAMILY = 'image';
const DEFAULT_LIFECYCLE: ToolLifecycle = 'ready';
const DEFAULT_EXECUTION: ToolExecution = 'browser-local';
const DEFAULT_CONTRACTS: readonly ToolContractLevel[] = ['structural', 'runtime', 'artifact'];

function withOperationalMetadata(tool: ToolConfig): ManagedTool {
  return Object.freeze({
    ...tool,
    family: DEFAULT_FAMILY,
    lifecycle: tool.isReady ? DEFAULT_LIFECYCLE : 'experimental',
    execution: DEFAULT_EXECUTION,
    contracts: DEFAULT_CONTRACTS,
  });
}

function freezeMap<T>(map: Map<string, T>): ReadonlyMap<string, T> {
  return map;
}

export function createToolCatalog(source: readonly ToolConfig[]): ToolCatalog {
  const all = Object.freeze(source.map(withOperationalMetadata));
  const byId = new Map<string, ManagedTool>();
  const byPath = new Map<string, ManagedTool>();
  const byAlias = new Map<string, ManagedTool>();

  for (const tool of all) {
    if (byId.has(tool.id)) throw new Error(`Duplicate managed tool id: ${tool.id}`);
    if (byPath.has(tool.path)) throw new Error(`Duplicate managed tool path: ${tool.path}`);
    byId.set(tool.id, tool);
    byPath.set(tool.path, tool);
    for (const alias of tool.aliases ?? []) {
      if (byAlias.has(alias) || byPath.has(alias)) throw new Error(`Duplicate managed tool route: ${alias}`);
      byAlias.set(alias, tool);
    }
  }

  return Object.freeze({
    all,
    ready: Object.freeze(all.filter((tool) => tool.isReady)),
    byId: freezeMap(byId),
    byPath: freezeMap(byPath),
    byAlias: freezeMap(byAlias),
  });
}
