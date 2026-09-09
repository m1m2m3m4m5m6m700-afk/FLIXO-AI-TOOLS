import type { ToolConfig } from '../tool-definitions/types.ts';

export type ToolLifecycle = 'experimental' | 'beta' | 'ready' | 'deprecated';
export type ToolExecution = 'browser-local' | 'browser-worker' | 'remote';
export type ToolContractLevel = 'structural' | 'runtime' | 'artifact';

export type ManagedTool = ToolConfig & {
  readonly family: string;
  readonly lifecycle: ToolLifecycle;
  readonly execution: ToolExecution;
  readonly contracts: readonly ToolContractLevel[];
};

export type ToolCatalog = Readonly<{
  readonly all: readonly ManagedTool[];
  readonly ready: readonly ManagedTool[];
  readonly byId: ReadonlyMap<string, ManagedTool>;
  readonly byPath: ReadonlyMap<string, ManagedTool>;
  readonly byAlias: ReadonlyMap<string, ManagedTool>;
}>;
