import { z } from 'zod';
import { TOOL_CATALOG } from '../../config/registry';
import { getCapability } from './capability-registry';
import { getWorkflow, WORKFLOW_REGISTRY } from '../workflows/registry';
import type { Workflow } from '@/lib/workflows/types';

export const WORKFLOW_TOOL_PREFIX = 'workflow:';
export const WORKFLOW_TOOL_VERSION = 1 as const;

export const WorkflowToolSchema = z.object({
  id: z.string().regex(/^workflow:[a-z0-9-]+$/),
  version: z.literal(WORKFLOW_TOOL_VERSION),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(1_000),
  kind: z.literal('workflow'),
  executable: z.boolean(),
  stepCount: z.number().int().min(0).max(32),
  toolIds: z.array(z.string().min(1)).max(32),
}).strict();

export type WorkflowTool = z.infer<typeof WorkflowToolSchema>;

export const getWorkflowToolId = (workflowId: string): string => WORKFLOW_TOOL_PREFIX + workflowId;

export const isWorkflowToolId = (value: string): boolean => value.startsWith(WORKFLOW_TOOL_PREFIX);

export const getWorkflowIdFromToolId = (value: string): string | null =>
  isWorkflowToolId(value) ? value.slice(WORKFLOW_TOOL_PREFIX.length) || null : null;

function workflowIsExecutable(workflow: Workflow): boolean {
  return workflow.steps.length > 0
    && workflow.steps.length <= 4
    && workflow.steps.every((step) => getCapability(step.toolId)?.state === 'EXECUTABLE');
}

export function buildWorkflowToolCatalog(): readonly WorkflowTool[] {
  return Object.freeze(WORKFLOW_REGISTRY.map((workflow) => WorkflowToolSchema.parse({
    id: getWorkflowToolId(workflow.id),
    version: WORKFLOW_TOOL_VERSION,
    title: workflow.title,
    description: workflow.description,
    kind: 'workflow',
    executable: workflowIsExecutable(workflow),
    stepCount: workflow.steps.length,
    toolIds: workflow.steps.map((step) => step.toolId),
  })));
}

export function expandWorkflowTool(toolId: string): {
  workflowId: string;
  title: string;
  confidence: number;
  catalogFingerprint: string;
  steps: Array<{ toolId: string; params?: Record<string, string | number | boolean | undefined> }>;
} | null {
  const workflowId = getWorkflowIdFromToolId(toolId);
  if (!workflowId) return null;
  const workflow = getWorkflow(workflowId);
  if (!workflow || !workflowIsExecutable(workflow)) return null;
  return {
    workflowId,
    title: workflow.title,
    confidence: 0.99,
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    steps: workflow.steps.map((step) => ({
      toolId: step.toolId,
      params: step.params,
    })),
  };
}

export function getWorkflowTool(toolId: string): WorkflowTool | null {
  return buildWorkflowToolCatalog().find((tool) => tool.id === toolId) ?? null;
}
