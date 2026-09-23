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

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return readUint16LE(bytes, offset) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function text4(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function extractImageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } | undefined {
  if (mimeType === 'image/png' && bytes.length >= 24 &&
      text4(bytes, 12) === 'IHDR') {
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    if (width > 0 && height > 0) return { width, height };
  }

  if (mimeType === 'image/webp' && bytes.length >= 30 &&
      text4(bytes, 0) === 'RIFF' && text4(bytes, 8) === 'WEBP' && text4(bytes, 12) === 'VP8X') {
    const width = 1 + readUint24LE(bytes, 24);
    const height = 1 + readUint24LE(bytes, 27);
    if (width > 0 && height > 0) return { width, height };
  }

  if (mimeType === 'image/jpeg' && bytes.length >= 4 &&
      bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
      if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
      const isSof = [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
      if (isSof && segmentLength >= 7) {
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        if (width > 0 && height > 0) return { width, height };
      }
      offset += segmentLength;
    }
  }

  return undefined;
}

async function readImageDimensions(blob: Blob, bytes: Uint8Array): Promise<{ width: number; height: number } | undefined> {
  if (!blob.type.startsWith('image/')) return undefined;
  const parsed = extractImageDimensions(bytes, blob.type);
  if (parsed) return parsed;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }
  if (typeof Image === 'undefined' || typeof URL === 'undefined') return undefined;
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    return { width: image.width, height: image.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function toOutputContractResult(toolId: string, outputBlob: Blob): Promise<ToolOutputResult> {
  const bytes = new Uint8Array(await outputBlob.arrayBuffer());
  return {
    mimeType: outputBlob.type,
    byteLength: outputBlob.size,
    bytes,
    filename: `flixo-${toolId}-output.${extensionForMime(outputBlob.type)}`,
    dimensions: await readImageDimensions(outputBlob, bytes),
  };
}

export async function verifyPipelineOutput(toolId: string, inputBlob: Blob, outputBlob: Blob, params: PipelineParams): Promise<boolean> {
  const capability = getCapability(toolId);
  if (!capability) return false;
  const tool = getToolById(toolId);
  if (!tool) return false;
  const contract = getToolOutputContractForDefinition(tool);
  if (!contract) return false;

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, capability.safetyLimits.timeoutMs);
  });
  let capabilityVerified: boolean;
  try {
    capabilityVerified = await Promise.race([capability.verifier(inputBlob, outputBlob, params, controller.signal), timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
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
      const authorization = await authorizeExecution({
        task,
        capabilityId: step.toolId,
        parameters: params,
        inputBlob: stableBlob,
      });
      params = authorization.parameters;
      let auditEventsForAttempt: readonly ExecutionAuditEvent[];
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
        const executionAudit = await createExecutionAuditEvent({
          task,
          capabilityId: step.toolId,
          tool,
          stage: 'EXECUTION',
          outcome: 'SUCCESS',
        });
        lastOutput = output;
        verified = await verifyPipelineOutput(step.toolId, stableBlob, output, params);
        const verificationAudit = await createExecutionAuditEvent({
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
        onProgress({ currentStepIndex: i + 1, totalSteps: plan.steps.length, currentToolId: step.toolId, task, retry: attempt, auditEvents: auditEventsForAttempt });
      } catch (error) {
        const message = error instanceof Error ? error.message : `Step '${step.toolId}' failed.`;
        const failureAudit = await createExecutionAuditEvent({
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
        const recoveryAudit = await createExecutionAuditEvent({
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
