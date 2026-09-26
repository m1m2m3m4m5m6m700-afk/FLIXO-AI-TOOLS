import { TOOL_CATALOG } from '@/config/registry.ts';
import { getToolDefinition } from '@/config/canonical-tool-definition.ts';
import { deriveToolSecurityProfile, type ExecutionRisk } from './execution-observability.ts';
import { parseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan.ts';
import { WORKFLOW_REGISTRY } from '@/lib/workflows/registry.ts';

export const WORKFLOW_TOOL_PREFIX = 'workflow:' as const;
export const WORKFLOW_TOOL_CONTRACT_VERSION = 1 as const;

export type WorkflowToolId = string;

export type WorkflowToolDescriptor = Readonly<{
  contractVersion: typeof WORKFLOW_TOOL_CONTRACT_VERSION;
  id: WorkflowToolId;
  title: string;
  description: string;
  intents: readonly string[];
  stepToolIds: readonly string[];
  inputSchema: Readonly<{
    type: 'object';
    properties: Readonly<Record<string, Readonly<{ type: string; required: boolean }>>>;
  }>;
  outputSchema: Readonly<{
    type: 'object';
    properties: Readonly<Record<string, string>>;
  }>;
  riskLevel: ExecutionRisk | 'BLOCKED';
  requiresConfirmation: boolean;
  kind: 'WORKFLOW_TOOL';
}>;

function rankRisk(risk: ExecutionRisk | 'BLOCKED'): number {
  if (risk === 'BLOCKED') return 4;
  if (risk === 'HIGH') return 3;
  if (risk === 'MEDIUM') return 2;
  return 1;
}

function deriveWorkflowRisk(stepToolIds: readonly string[]): ExecutionRisk | 'BLOCKED' {
  let highest: ExecutionRisk | 'BLOCKED' = 'LOW';
  for (const id of stepToolIds) {
    const tool = getToolDefinition(id);
    if (!tool || !tool.isReady || tool.capability.state !== 'EXECUTABLE') return 'BLOCKED';
    const risk = deriveToolSecurityProfile(tool).risk;
    if (rankRisk(risk) > rankRisk(highest)) highest = risk;
  }
  return highest;
}

export function toWorkflowTool(
  workflow: (typeof WORKFLOW_REGISTRY)[number],
): WorkflowToolDescriptor {
  const stepToolIds = Object.freeze(workflow.steps.map((step) => step.toolId));
  const riskLevel = deriveWorkflowRisk(stepToolIds);
  const requiresConfirmation = riskLevel === 'MEDIUM' || riskLevel === 'HIGH';

  const inputEntries = workflow.steps.flatMap((step) =>
    Object.keys(step.params ?? {}).map((key) => [
      key,
      { type: typeof (step.params ?? {})[key], required: !step.optional },
    ] as const)
  );

  const inputSchema = Object.freeze({
    type: 'object' as const,
    properties: Object.freeze(Object.fromEntries(inputEntries)),
  });

  const outputSchema = Object.freeze({
    type: 'object' as const,
    properties: Object.freeze({
      artifact: 'verified output artifact of the final workflow step',
      completedSteps: 'ordered list of completed canonical tool ids',
      verification: 'verification result for each completed step',
    }),
  });

  return Object.freeze({
    contractVersion: WORKFLOW_TOOL_CONTRACT_VERSION,
    id: WORKFLOW_TOOL_PREFIX + workflow.id,
    title: workflow.title,
    description: workflow.description,
    intents: Object.freeze([...workflow.intentPatterns]),
    stepToolIds,
    inputSchema,
    outputSchema,
    riskLevel,
    requiresConfirmation,
    kind: 'WORKFLOW_TOOL' as const,
  });
}

export const WORKFLOW_TOOL_CATALOG: readonly WorkflowToolDescriptor[] = Object.freeze(
  WORKFLOW_REGISTRY.map(toWorkflowTool),
);

export function getWorkflowTool(id: string): WorkflowToolDescriptor | undefined {
  return WORKFLOW_TOOL_CATALOG.find((tool) => tool.id === id);
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

export function getWorkflowForTool(toolId: string) {
  const workflowId = toolId.startsWith(WORKFLOW_TOOL_PREFIX)
    ? toolId.slice(WORKFLOW_TOOL_PREFIX.length)
    : toolId;
  return WORKFLOW_REGISTRY.find((workflow) => workflow.id === workflowId);
}

export function expandWorkflowTool(toolId: string): ExecutionPlanContract | null {
  const workflow = getWorkflowForTool(toolId);
  if (!workflow) return null;

  return parseExecutionPlan({
    workflowName: workflow.title,
    confidence: 0.99,
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    steps: workflow.steps.map((step) => ({
      toolId: step.toolId,
      params: step.params,
    })),
  });
}
