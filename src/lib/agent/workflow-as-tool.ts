import { planFromWorkflow, type ExecutionPlan } from '@/lib/ai/planner.ts';
import { WORKFLOW_REGISTRY, getWorkflow } from '@/lib/workflows/registry.ts';
import type { WorkflowId } from '@/lib/workflows/types.ts';

export const WORKFLOW_TOOL_PREFIX = 'workflow:' as const;

export type WorkflowToolId = `workflow:${WorkflowId}`;

export type WorkflowToolDescriptor = Readonly<{
  id: WorkflowToolId;
  title: string;
  description: string;
  intents: readonly string[];
  stepToolIds: readonly string[];
  kind: 'WORKFLOW_TOOL';
}>;

/**
 * Workflow tools are derived from the canonical workflow registry.
 * They are planning macros, not a second execution registry.
 */
export function toWorkflowTool(workflow: (typeof WORKFLOW_REGISTRY)[number]): WorkflowToolDescriptor {
  return Object.freeze({
    id: `${WORKFLOW_TOOL_PREFIX}${workflow.id}` as WorkflowToolId,
    title: workflow.title,
    description: workflow.description,
    intents: Object.freeze([...workflow.intentPatterns]),
    stepToolIds: Object.freeze(workflow.steps.map((step) => step.toolId)),
    kind: 'WORKFLOW_TOOL',
  });
}

export const WORKFLOW_TOOL_CATALOG: readonly WorkflowToolDescriptor[] = Object.freeze(
  WORKFLOW_REGISTRY.map(toWorkflowTool),
);

const byId = new Map(WORKFLOW_TOOL_CATALOG.map((tool) => [tool.id, tool]));

export function getWorkflowTool(id: string): WorkflowToolDescriptor | undefined {
  return byId.get(id);
}

export function resolveWorkflowTool(input: string): WorkflowToolDescriptor | null {
  const normalized = input.trim().toLocaleLowerCase();
  if (!normalized) return null;

  const direct = getWorkflowTool(normalized);
  if (direct) return direct;

  const ranked = WORKFLOW_TOOL_CATALOG
    .map((tool) => ({
      tool,
      score: tool.intents.reduce((score, pattern) => {
        const candidate = pattern.toLocaleLowerCase();
        if (!candidate) return score;
        return normalized.includes(candidate) ? score + candidate.length : score;
      }, 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.tool ?? null;
}

export function planFromWorkflowTool(toolId: string): ExecutionPlan | null {
  const workflowId = toolId.startsWith(WORKFLOW_TOOL_PREFIX)
    ? toolId.slice(WORKFLOW_TOOL_PREFIX.length)
    : toolId;
  const workflow = getWorkflow(workflowId);
  return workflow ? planFromWorkflow(workflow.id) : null;
}

export function expandWorkflowTool(
  toolId: string,
  input?: string,
): ExecutionPlan | null {
  const direct = planFromWorkflowTool(toolId);
  if (direct) return direct;
  const resolved = input ? resolveWorkflowTool(input) : null;
  return resolved ? planFromWorkflowTool(resolved.id) : null;
}
