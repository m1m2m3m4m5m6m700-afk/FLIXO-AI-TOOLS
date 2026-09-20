import type { ExecutionPlan } from '@/lib/ai/planner';
import { assertExecutionAllowed, type TaskContext } from '@/lib/agent/task-state';
import { authorizeExecution } from '@/lib/agent/execution-gate';
import { classifyExecutionFailure, createExecutionAuditEvent, deriveRecoveryMetadata, type ExecutionAuditEvent } from '@/lib/agent/execution-observability';
import { assertExecutionResourceBudget, getCapability, validateCapabilityParameters, type CapabilityParameters } from '@/lib/agent/capability-registry';
import { getToolById, TOOL_CATALOG } from '@/config/registry';
import { getToolExecutor, repairToolParameters } from '@/lib/workflows/executor-registry';
import { getToolOutputContractForDefinition } from '@/lib/contracts/tool-output-contracts';
import { assertToolOutputContract, type ToolOutputResult } from '@/lib/contracts/tool-output';
import { appendPipelineStepReceipt, assertPipelineReceiptChain, createPipelinePlanFingerprint, createPipelineReceiptChain, createPipelineStepReceipt, type PipelineReceiptChain, type PipelineStepReceipt } from '@/lib/workflows/pipeline-receipt';

export interface PipelineProgress { currentStepIndex: number; totalSteps: number; currentToolId: string; task: TaskContext; outputBlob?: Blob; retry?: number; receipt?: PipelineStepReceipt; receiptChain?: PipelineReceiptChain; auditEvents?: readonly ExecutionAuditEvent[]; }
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

export async function runWorkflowPipeline(initialFile: File, plan: ExecutionPlan, task: TaskContext, onProgress: (progress: PipelineProgress) => void): Promise<Blob> {
  assertExecutionAllowed(task);
  if (plan.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Execution plan is stale because the canonical tool catalog changed.');
  if (plan.steps.length === 0 || plan.steps.length > 4) throw new Error('FLIXO plans must contain 1 to 4 steps.');
  let currentBlob: Blob = initialFile;
  const planFingerprint = await createPipelinePlanFingerprint(plan);
  let receiptChain = createPipelineReceiptChain(TOOL_CATALOG.fingerprint, planFingerprint, task.taskId, task.traceId, task.revision);

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
    const recoveryMetadata = deriveRecoveryMetadata(tool);
    const maxAttempts = Math.max(1, recoveryMetadata.maxAttempts);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const authorization = authorizeExecution({
        task,
        capabilityId: step.toolId,
        parameters: params,
        inputBlob: stableBlob,
      });
      params = authorization.parameters;
      let auditEventsForAttempt: readonly ExecutionAuditEvent[] = [authorization.audit];
      onProgress({
        currentStepIndex: i + 1,
        totalSteps: plan.steps.length,
        currentToolId: step.toolId,
        task,
        retry: attempt,
        auditEvents: [authorization.audit],
      });
      try {
        const output = await executor({ tool, inputBlob: stableBlob, parameters: params });
        const executionAudit = createExecutionAuditEvent({
          task,
          capabilityId: step.toolId,
          tool,
          stage: 'EXECUTION',
          outcome: 'SUCCESS',
        });
        lastOutput = output;
        verified = await verifyPipelineOutput(step.toolId, stableBlob, output, params);
        const verificationAudit = createExecutionAuditEvent({
          task,
          capabilityId: step.toolId,
          tool,
          stage: 'VERIFICATION',
          outcome: verified ? 'SUCCESS' : 'FAILURE',
          errorClass: verified ? undefined : 'OUTPUT',
          message: verified ? undefined : `Output verification failed for '${step.toolId}'.`,
        });
        const receipt = await createPipelineStepReceipt({ toolId: step.toolId, stepIndex: i + 1, attempt, inputBlob: stableBlob, outputBlob: output, catalogFingerprint: TOOL_CATALOG.fingerprint, verified });
        auditEventsForAttempt = Object.freeze([authorization.audit, executionAudit, verificationAudit]);
        if (verified) {
          receiptChain = await appendPipelineStepReceipt(receiptChain, receipt);
          currentBlob = output;
          onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, task, outputBlob: output, retry: attempt, receipt, receiptChain, auditEvents: auditEventsForAttempt });
          break;
        }
        onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, task, retry: attempt, auditEvents });
      } catch (error) {
        const message = error instanceof Error ? error.message : `Step '${step.toolId}' failed.`;
        const failureAudit = createExecutionAuditEvent({
          task,
          capabilityId: step.toolId,
          tool,
          stage: 'EXECUTION',
          outcome: 'FAILURE',
          message,
          errorClass: classifyExecutionFailure(error),
        });
        auditEventsForAttempt = Object.freeze([authorization.audit, failureAudit]);
        onProgress({
          currentStepIndex: i + 1,
          totalSteps: plan.steps.length,
          currentToolId: step.toolId,
          task,
          retry: attempt,
          auditEvents: auditEventsForAttempt,
        });
        if (attempt === maxAttempts - 1) throw new PipelineVerificationError(message, stableBlob, i, step.toolId);
      }

      if (!verified && attempt < maxAttempts - 1) {
        const recoveryAudit = createExecutionAuditEvent({
          task,
          capabilityId: step.toolId,
          tool,
          stage: 'RECOVERY',
          outcome: recoveryMetadata.retryAllowed ? 'ALLOW' : 'BLOCK',
          errorClass: 'OUTPUT',
          message: recoveryMetadata.retryAllowed
            ? `Recovery attempt ${attempt + 1} is allowed by the canonical tool recovery policy.`
            : `Recovery is blocked for '${step.toolId}' by the canonical tool recovery policy.`,
        });
        onProgress({
          currentStepIndex: i + 1,
          totalSteps: plan.steps.length,
          currentToolId: step.toolId,
          task,
          retry: attempt + 1,
          auditEvents: Object.freeze([...auditEventsForAttempt, recoveryAudit]),
        });
        const repaired = repairToolParameters(tool, params, attempt + 1);
        if (repaired) params = validateCapabilityParameters(step.toolId, repaired);
        else if (lastOutput === null) throw new PipelineVerificationError(`Verification failed for '${step.toolId}'.`, stableBlob, i, step.toolId);
      }
    }

    if (!verified) throw new PipelineVerificationError(`Verification failed for '${step.toolId}'.`, stableBlob, i, step.toolId);
  }

  await assertPipelineReceiptChain(receiptChain, plan);
  return currentBlob;
}
