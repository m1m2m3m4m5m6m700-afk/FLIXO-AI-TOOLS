import type { ToolDefinition } from '@/config/canonical-tool-definition.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '@/lib/agent/canonical-capability-definition.ts';

export function getCanonicalMvpAgentTools(
  tools: readonly ToolDefinition[],
): readonly ToolDefinition[] {
  const executableIds = new Set<string>(MVP_EXECUTABLE_TOOL_IDS);
  return tools.filter((tool) => executableIds.has(tool.id) && tool.capability.state === 'EXECUTABLE');
}
