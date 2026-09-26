import { TOOL_CATALOG, getToolById } from '@/config/registry.ts';
import { getToolDefinition } from '@/config/canonical-tool-definition.ts';
import { parseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan.ts';
import { getToolOutputContractForDefinition } from '@/lib/contracts/tool-output-contracts.ts';
import { WORKFLOW_REGISTRY } from '@/lib/workflows/registry.ts';
import type { WorkflowId } from '@/lib/workflows/types.ts';

export const WORKFLOW_TOOL_PREFIX = 'workflow:' as const;

export type WorkflowToolId = `workflow:${WorkflowId}`;
export type WorkflowToolRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export type WorkflowToolInputSchema = Readonly<{
  kind: 'CANONICAL_STEP_PARAMETERS';
  steps: readonly Readonly<{
    toolId: string;
    optional: boolean;
    parameterKeys: readonly string[];
  }>[];
}>;

export type WorkflowToolOutputSchema = Readonly<{
  kind: 'CANONICAL_OUTPUT_CONTRACTS';
  steps: readonly Readonly<{
    toolId: string;
    outputContractId: string | null;
  }>[];
}>;

export type WorkflowToolDescriptor = Readonly<{
  id: WorkflowToolId;
  title: string;
  description: string;
  intents: readonly string[];
  stepToolIds: readonly string[];
  inputSchema: WorkflowToolInputSchema;
  outputSchema: WorkflowToolOutputSchema;
  riskLevel: WorkflowToolRisk;
  requiresConfirmation: boolean;
  kind: 'WORKFLOW_TOOL';
}>;

function parameterKeys(toolId: string): readonly string[] {
  const capability = getToolDefinition(toolId);
  if (!capability) return Object.freeze([]);
  const schema = capability.parameterSchema as { shape?: Record<string, unknown> };
  return Object.freeze(schema.shape ? Object.keys(schema.shape) : []);
}

function riskForTool(toolId: string): WorkflowToolRisk {
  const tool = getToolDefinition(toolId);
  if (!tool) return 'HIGH';
  if (tool.executionMode === 'CLOUD') return 'HIGH';
  if (tool.requirements.network) return 'MEDIUM';
  return 'LOW';
}

function higherRisk(left: WorkflowToolRisk, right: WorkflowToolRisk): WorkflowToolRisk {
  const rank: Record<WorkflowToolRisk, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return rank[right] > rank[left] ? right : left;
}

export function toWorkflowTool(workflow: (typeof WORKFLOW_REGISTRY)[number]): WorkflowToolDescriptor {
  const inputSteps = workflow.steps.map((step) => Object.freeze({
    toolId: step.toolId,
    optional: Boolean(step.optional),
    parameterKeys: parameterKeys(step.toolId),
  }));
  const outputSteps = workflow.steps.map((step) => {
    const tool = getToolById(step.toolId);
    const outputContract = tool ? getToolOutputContractForDefinition(tool) : undefined;
    return Object.freeze({
      toolId: step.toolId,
      outputContractId: outputContract?.toolId ?? tool?.operational.outputContractId ?? null,
    });
  });
  const riskLevel = workflow.steps.reduce<WorkflowToolRisk>(
    (risk, step) => higherRisk(risk, riskForTool(step.toolId)),
    'LOW',
  );

  return Object.freeze({
    id: `${WORKFLOW_TOOL_PREFIX}${workflow.id}` as WorkflowToolId,
    title: workflow.title,
    description: workflow.description,
    intents: Object.freeze([...workflow.intentPatterns]),
    stepToolIds: Object.freeze(workflow.steps.map((step) => step.toolId)),
    inputSchema: Object.freeze({
      kind: 'CANONICAL_STEP_PARAMETERS',
      steps: Object.freeze(inputSteps),
    }),
    outputSchema: Object.freeze({
      kind: 'CANONICAL_OUTPUT_CONTRACTS',
      steps: Object.freeze(outputSteps),
    }),
    riskLevel,
    requiresConfirmation: riskLevel !== 'LOW',
    kind: 'WORKFLOW_TOOL',
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
