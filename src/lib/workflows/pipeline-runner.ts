import type { ExecutionPlan } from '@/lib/ai/planner';
import { assertExecutionResourceBudget, getCapability, validateCapabilityParameters, type CapabilityParameters } from '@/lib/agent/capability-registry';
import { getToolById, TOOL_CATALOG } from '@/config/registry';
import { getToolExecutor, repairToolParameters } from '@/lib/workflows/executor-registry';
import { assertToolOutputContract, getToolOutputContractForDefinition, type ToolOutputResult } from '@/lib/contracts/tool-output-contracts';
import { appendPipelineStepReceipt, createPipelineReceiptChain, createPipelineStepReceipt, type PipelineReceiptChain, type PipelineStepReceipt } from '@/lib/workflows/pipeline-receipt';

export interface PipelineProgress { currentStepIndex: number; totalSteps: number; currentToolId: string; outputBlob?: Blob; retry?: number; receipt?: PipelineStepReceipt; receiptChain?: PipelineReceiptChain; }
export class PipelineVerificationError extends Error {
  constructor(message: string, readonly stableBlob: Blob, readonly failedStepIndex: number, readonly failedToolId: string) { super(message); this.name = 'PipelineVerificationError'; }
}
type PipelineParams = CapabilityParameters;

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'text/plain': 'txt',
    'application/json': 'json',
  };
  return map[mimeType] ?? 'bin';
}

async function toOutputContractResult(toolId: string, outputBlob: Blob): Promise<ToolOutputResult> {
  const bytes = new Uint8Array(await outputBlob.arrayBuffer());
  return {
    mimeType: outputBlob.type,
    byteLength: outputBlob.size,
    bytes,
    filename: `flixo-${toolId}-output.${extensionForMime(outputBlob.type)}`,
  };
}

export async function verifyPipelineOutput(toolId: string, inputBlob: Blob, outputBlob: Blob, params: PipelineParams): Promise<boolean> {
  const capability = getCapability(toolId);
  if (!capability) return false;
  const tool = getToolById(toolId);
  if (!tool) return false;
  const contract = getToolOutputContractForDefinition(tool);
  if (!contract) return false;

  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), capability.safetyLimits.timeoutMs));
  const capabilityVerified = await Promise.race([capability.verifier(inputBlob, outputBlob, params), timeout]);
  if (!capabilityVerified) return false;

  try {
    assertToolOutputContract(contract, await toOutputContractResult(toolId, outputBlob));
    return true;
  } catch {
    return false;
  }
}

export async function runWorkflowPipeline(initialFile: File, plan: ExecutionPlan, onProgress: (progress: PipelineProgress) => void): Promise<Blob> {
  if (plan.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Execution plan is stale because the canonical tool catalog changed.');
  if (plan.steps.length === 0 || plan.steps.length > 4) throw new Error('FLIXO plans must contain 1 to 4 steps.');
  let currentBlob: Blob = initialFile;
  let receiptChain = createPipelineReceiptChain(TOOL_CATALOG.fingerprint);

  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    const capability = getCapability(step.toolId);
    if (!capability || capability.state !== 'EXECUTABLE') throw new Error(`Capability '${step.toolId}' is not executable by the local pipeline.`);
    const tool = getToolById(step.toolId);
    if (!tool) throw new Error(`Registered tool '${step.toolId}' could not be loaded.`);

    const executor = getToolExecutor(tool);
    const stableBlob = currentBlob;
    let params: PipelineParams = validateCapabilityParameters(step.toolId, step.params ?? {});
    assertExecutionResourceBudget(step.toolId, stableBlob);
    let verified = false;
    let lastOutput: Blob | null = null;
    const maxAttempts = Math.max(1, tool.recovery.maxAttempts);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, retry: attempt });
      try {
        const output = await executor({ tool, inputBlob: stableBlob, parameters: params });
        lastOutput = output;
        verified = await verifyPipelineOutput(step.toolId, stableBlob, output, params);
        const receipt = await createPipelineStepReceipt({ toolId: step.toolId, stepIndex: i + 1, attempt, inputBlob: stableBlob, outputBlob: output, catalogFingerprint: TOOL_CATALOG.fingerprint, verified });
        if (verified) {
          receiptChain = await appendPipelineStepReceipt(receiptChain, receipt);
          currentBlob = output;
          onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, outputBlob: output, retry: attempt, receipt, receiptChain });
          break;
        }
      } catch (error) {
        if (attempt === maxAttempts - 1) throw new PipelineVerificationError(error instanceof Error ? error.message : `Step '${step.toolId}' failed.`, stableBlob, i, step.toolId);
      }

      if (!verified && attempt < maxAttempts - 1) {
        const repaired = repairToolParameters(tool, params, attempt + 1);
        if (repaired) params = validateCapabilityParameters(step.toolId, repaired);
        else if (lastOutput === null) throw new PipelineVerificationError(`Verification failed for '${step.toolId}'.`, stableBlob, i, step.toolId);
      }
    }

    if (!verified) throw new PipelineVerificationError(`Verification failed for '${step.toolId}'.`, stableBlob, i, step.toolId);
  }

  return currentBlob;
}
