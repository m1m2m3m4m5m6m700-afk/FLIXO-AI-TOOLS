import type { ToolDefinition } from '@/config/canonical-tool-definition.ts';
import { deriveToolSecurityProfile } from './execution-observability.ts';

export type ToolProfile = Readonly<{
  id: string;
  purpose: string;
  permission: 'READ' | 'WRITE' | 'EXECUTE';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  executionMode: ToolDefinition['executionMode'];
}>;

export function projectToolProfile(tool: ToolDefinition): ToolProfile {
  const security = deriveToolSecurityProfile(tool);
  return Object.freeze({
    id: tool.id,
    purpose: tool.description,
    permission: security.permission,
    risk: security.risk,
    executionMode: tool.executionMode,
  });
}

export function canUseTool(tool: Pick<ToolProfile, 'permission' | 'risk'>, granted: readonly ToolProfile['permission'][]): boolean {
  if (!granted.includes(tool.permission)) return false;
  if (tool.risk === 'HIGH' && tool.permission === 'EXECUTE' && !granted.includes('WRITE')) return false;
  return true;
}
