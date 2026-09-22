import type { ToolDefinition } from '@/config/canonical-tool-definition';
import { getToolDefinition } from '@/config/canonical-tool-definition';
import { deriveToolSecurityProfile, type ExecutionPermission, type ExecutionRisk } from './execution-observability';

export type ToolProfile = Readonly<{
  id: ToolDefinition['id'];
  purpose: string;
  permission: ExecutionPermission;
  risk: ExecutionRisk;
  failureModes: readonly string[];
  definition: ToolDefinition;
}>;

export function getToolProfile(toolId: string): ToolProfile {
  const definition = getToolDefinition(toolId);
  if (!definition) throw new Error(`Unknown tool id: ${toolId}`);
  const security = deriveToolSecurityProfile(definition);
  const failureModes = [
    definition.capability.state !== 'EXECUTABLE' ? 'NOT_EXECUTABLE' : null,
    definition.requirements.network ? 'EXTERNAL_PROCESSING' : null,
    definition.recovery.maxAttempts === 0 ? 'NO_RETRY_BUDGET' : null,
  ].filter((value): value is string => value !== null);

  return Object.freeze({
    id: definition.id,
    purpose: definition.description,
    permission: security.permission,
    risk: security.risk,
    failureModes: Object.freeze(failureModes),
    definition,
  });
}

export function canUseTool(tool: ToolProfile, granted: readonly ExecutionPermission[]): boolean {
  if (!granted.includes(tool.permission)) return false;
  if (tool.risk === 'HIGH' && tool.permission === 'EXECUTE' && !granted.includes('WRITE')) return false;
  return true;
}
