import type { ToolCatalogSource } from './types.ts';
import type { ManagedTool, ToolCatalog } from './types.ts';

function freezeMap<T>(map: Map<string, T>): ReadonlyMap<string, T> {
  return map;
}

export function createToolCatalog(source: readonly ToolCatalogSource[]): ToolCatalog {
  const all = Object.freeze([...source].slice().sort((a, b) => a.id.localeCompare(b.id)));
  const byId = new Map<string, ManagedTool>();
  const byPath = new Map<string, ManagedTool>();
  const byAlias = new Map<string, ManagedTool>();
  const claimedRoutes = new Set<string>();

  for (const tool of all) {
    if (!tool.id.trim()) throw new Error('Tool id must not be empty.');
    if (byId.has(tool.id)) throw new Error(`Duplicate managed tool id: ${tool.id}`);
    if (claimedRoutes.has(tool.path)) throw new Error(`Duplicate managed tool path: ${tool.path}`);
    if (!tool.component) throw new Error(`Tool component is missing: ${tool.id}`);
    if (!tool.parameterSchema) throw new Error(`Tool input contract is missing: ${tool.id}`);
    if (!tool.verifier) throw new Error(`Tool verifier contract is missing: ${tool.id}`);
    if (!tool.recovery || tool.recovery.maxAttempts < 0) throw new Error(`Tool recovery contract is invalid: ${tool.id}`);
    if (!tool.operational || !tool.operational.lifecycle || !tool.operational.execution) throw new Error(`Tool operational profile is missing: ${tool.id}`);
    byId.set(tool.id, tool);
    byPath.set(tool.path, tool);
    claimedRoutes.add(tool.path);
  }

  for (const tool of all) {
    for (const alias of tool.aliases) {
      if (claimedRoutes.has(alias)) throw new Error(`Duplicate managed tool route: ${alias}`);
      claimedRoutes.add(alias);
      byAlias.set(alias, tool);
    }
  }

  if (byId.size !== all.length) throw new Error(`Tool catalog discovery mismatch: indexed=${byId.size}, source=${all.length}`);

  return Object.freeze({
    all,
    ready: Object.freeze(all.filter((tool) => tool.isReady)),
    byId: freezeMap(byId),
    byPath: freezeMap(byPath),
    byAlias: freezeMap(byAlias),
  });
}


export function loadToolCatalog(source: readonly ToolCatalogSource[]): ToolCatalog {
  return createToolCatalog(source);
}
