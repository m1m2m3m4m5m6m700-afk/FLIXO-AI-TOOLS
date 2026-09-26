import type { ToolDefinition } from '@/config/canonical-tool-definition.ts';

export const FLIXO_MVP_SCOPE = Object.freeze({
  workflow: Object.freeze({
    agentGuided: true,
    manualStandalone: true,
    deterministicStandardIntents: true,
    gracefulManualFallback: true,
  }),
  processing: Object.freeze({
    executionLocation: 'BROWSER_ONLY',
    allowedEngines: Object.freeze(['HTML5_CANVAS', 'WEB_WORKER', 'WASM']),
    userFileBytesMayCrossNetwork: false,
    backendRequiredForFileExecution: false,
  }),
  hosting: Object.freeze({
    staticCdnOnly: true,
  }),
  offline: Object.freeze({
    executableAfterAssetsLoaded: true,
  }),
} as const);

type MVPScopedTool = Pick<
  ToolDefinition,
  'id' | 'isReady' | 'path' | 'capability' | 'executionMode' |
    'requirements' | 'operational' | 'parameterSchema' | 'verifier'
>;

export function assertMvpLocalExecutionBoundary(tool: MVPScopedTool): void {
  if (tool.capability.state !== 'EXECUTABLE') {
    throw new Error(`MVP execution denied for non-executable capability: ${tool.id}`);
  }
  if (!tool.isReady) throw new Error(`MVP executable capability is not ready: ${tool.id}`);
  if (!tool.path.startsWith('/en/')) throw new Error(`MVP manual route is missing: ${tool.id}`);
  if (tool.capability.intents.length === 0) {
    throw new Error(`MVP agent intent registration is missing: ${tool.id}`);
  }
  if (tool.executionMode !== 'LOCAL' || tool.requirements.network) {
    throw new Error(`MVP capability is not client-only: ${tool.id}`);
  }
  if (tool.operational.execution !== 'browser-local' && tool.operational.execution !== 'browser-worker') {
    throw new Error(`MVP capability has a non-browser execution adapter: ${tool.id}`);
  }
  if (!tool.operational.executorId) throw new Error(`MVP executor binding is missing: ${tool.id}`);
  if (!tool.operational.outputContractId) throw new Error(`MVP output contract binding is missing: ${tool.id}`);
  if (!tool.parameterSchema || !tool.verifier) {
    throw new Error(`MVP capability contract is incomplete: ${tool.id}`);
  }
}

export function assertMvpScope(
  tools: readonly MVPScopedTool[],
  executableIds: readonly string[],
): void {
  const executableSet = new Set(executableIds);
  const registeredExecutable = tools.filter((tool) => tool.capability.state === 'EXECUTABLE');
  const registeredIds = registeredExecutable.map((tool) => tool.id);

  if (registeredIds.length !== executableIds.length) {
    throw new Error(
      `MVP executable registry cardinality mismatch: expected ${executableIds.length}, got ${registeredIds.length}`,
    );
  }

  for (const id of executableIds) {
    const tool = tools.find((candidate) => candidate.id === id);
    if (!tool) throw new Error(`MVP executable capability is missing from registry: ${id}`);
    assertMvpLocalExecutionBoundary(tool);
  }

  const unexpected = registeredExecutable.filter((tool) => !executableSet.has(tool.id)).map((tool) => tool.id);
  if (unexpected.length) {
    throw new Error(`Unexpected executable capabilities outside MVP scope: ${unexpected.join(',')}`);
  }
}

export type FlixoAgentFileMetadata = Readonly<{
  name: string;
  type: string;
  size: number;
}>;

/**
 * Only non-content file metadata may be sent to an optional agent gateway.
 * Raw File/Blob bytes are never part of the agent request contract.
 */
export function toAgentFileMetadata(file: File | null | undefined): FlixoAgentFileMetadata | null {
  if (!file) return null;
  return Object.freeze({ name: file.name, type: file.type, size: file.size });
}
