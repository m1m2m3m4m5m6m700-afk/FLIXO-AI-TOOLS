import { getToolById, TOOL_CATALOG } from '@/config/registry';

export type PipelineStepReceipt = Readonly<{
  schemaVersion: '1';
  toolId: string;
  stepIndex: number;
  attempt: number;
  catalogFingerprint: string;
  inputSha256: string;
  outputSha256: string;
  verified: boolean;
  recoveryApplied: boolean;
}>;

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPipelineStepReceipt(input: Readonly<{
  toolId: string;
  stepIndex: number;
  attempt: number;
  inputBlob: Blob;
  outputBlob: Blob;
  catalogFingerprint: string;
  verified: boolean;
}>): Promise<PipelineStepReceipt> {
  if (!getToolById(input.toolId)) throw new Error(`Unknown pipeline tool: ${input.toolId}`);
  if (!Number.isInteger(input.stepIndex) || input.stepIndex < 1) throw new Error('Pipeline receipt stepIndex must be a positive integer.');
  if (!Number.isInteger(input.attempt) || input.attempt < 0) throw new Error('Pipeline receipt attempt must be a non-negative integer.');
  if (input.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Pipeline receipt catalog fingerprint is stale.');
  return Object.freeze({
    schemaVersion: '1',
    toolId: input.toolId,
    stepIndex: input.stepIndex,
    attempt: input.attempt,
    catalogFingerprint: input.catalogFingerprint,
    inputSha256: await sha256Blob(input.inputBlob),
    outputSha256: await sha256Blob(input.outputBlob),
    verified: input.verified,
    recoveryApplied: input.attempt > 0,
  });
}
