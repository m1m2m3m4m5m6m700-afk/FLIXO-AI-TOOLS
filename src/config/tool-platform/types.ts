import type { ToolDefinition } from '../canonical-tool-definition.ts';

export type ManagedTool = ToolDefinition;

export type ToolCatalog = Readonly<{
  readonly all: readonly ManagedTool[];
  readonly ready: readonly ManagedTool[];
  readonly byId: ReadonlyMap<string, ManagedTool>;
  readonly byPath: ReadonlyMap<string, ManagedTool>;
  readonly byAlias: ReadonlyMap<string, ManagedTool>;
  readonly fingerprint: string;
}>;

export type ToolCatalogSource = ToolDefinition;
