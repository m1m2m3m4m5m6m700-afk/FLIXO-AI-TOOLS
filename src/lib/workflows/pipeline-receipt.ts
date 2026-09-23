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
  executionMode: string;
  executorId: string;
}>;

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}


export type PipelineReceiptChain = Readonly<{
  schemaVersion: '1';
  catalogFingerprint: string;
  planFingerprint: string;
  taskId: string;
  traceId: string;
  taskRevision: number;
  steps: readonly PipelineStepReceipt[];
  chainSha256: string;
}>;

const EMPTY_CHAIN_SHA256 = '0'.repeat(64);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type PipelinePlanIdentity = Readonly<{
  workflowName: string;
  confidence: number;
  catalogFingerprint: string;
  steps: readonly Readonly<{
    toolId: string;
    params?: Readonly<Record<string, string | number | boolean | undefined>>;
  }>[];
}>;

function canonicalPlanPayload(plan: PipelinePlanIdentity): string {
  return JSON.stringify([
    plan.workflowName,
    plan.confidence,
    plan.catalogFingerprint,
    plan.steps.map((step) => [
      step.toolId,
      Object.entries(step.params ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    ]),
  ]);
}

export async function createPipelinePlanFingerprint(plan: PipelinePlanIdentity): Promise<string> {
  if (plan.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Pipeline plan catalog fingerprint is stale.');
  const fingerprint = await sha256Text(canonicalPlanPayload(plan));
  if (!SHA256_PATTERN.test(fingerprint)) throw new Error('Pipeline plan fingerprint generation failed.');
  return fingerprint;
}

function canonicalReceiptPayload(receipt: PipelineStepReceipt): string {
  return JSON.stringify([
    receipt.schemaVersion,
    receipt.toolId,
    receipt.stepIndex,
    receipt.attempt,
    receipt.catalogFingerprint,
    receipt.inputSha256,
    receipt.outputSha256,
    receipt.verified,
    receipt.recoveryApplied,
    receipt.executionMode,
    receipt.executorId,
  ]);
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createPipelineReceiptChain(
  catalogFingerprint: string,
  planFingerprint: string,
  taskId: string,
  traceId: string,
  taskRevision: number,
): PipelineReceiptChain {
  if (catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Pipeline receipt chain catalog fingerprint is stale.');
  if (!SHA256_PATTERN.test(planFingerprint)) throw new Error('Pipeline receipt chain plan fingerprint is invalid.');
  if (!taskId.trim() || !traceId.trim()) throw new Error('Pipeline receipt chain task identity is required.');
  if (!Number.isInteger(taskRevision) || taskRevision < 0) throw new Error('Pipeline receipt chain task revision is invalid.');
  return Object.freeze({
    schemaVersion: '1',
    catalogFingerprint,
    planFingerprint,
    taskId,
    traceId,
    taskRevision,
    steps: Object.freeze([]),
    chainSha256: EMPTY_CHAIN_SHA256,
  });
}

export async function appendPipelineStepReceipt(
  chain: PipelineReceiptChain,
  receipt: PipelineStepReceipt,
): Promise<PipelineReceiptChain> {
  if (chain.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Pipeline receipt chain catalog fingerprint is stale.');
  if (receipt.catalogFingerprint !== chain.catalogFingerprint) throw new Error('Pipeline receipt catalog fingerprint does not match the chain.');
  if (!receipt.verified) throw new Error('Only verified pipeline step receipts may enter the receipt chain.');
  if (!receipt.executionMode || !receipt.executorId) throw new Error('Pipeline receipt execution provenance is missing.');

  const previous = chain.steps[chain.steps.length - 1];
  if (previous) {
    if (receipt.stepIndex !== previous.stepIndex + 1) throw new Error('Pipeline receipt chain step index is not contiguous.');
    if (receipt.inputSha256 !== previous.outputSha256) throw new Error('Pipeline receipt chain artifact linkage is broken.');
  } else if (receipt.stepIndex !== 1) {
    throw new Error('Pipeline receipt chain must begin at step 1.');
  }

  const chainSha256 = await sha256Text(
    [
      chain.chainSha256,
      chain.catalogFingerprint,
      chain.planFingerprint,
      chain.taskId,
      chain.traceId,
      chain.taskRevision,
      canonicalReceiptPayload(receipt),
    ].join(':'),
  );
  return Object.freeze({
    schemaVersion: '1',
    catalogFingerprint: chain.catalogFingerprint,
    planFingerprint: chain.planFingerprint,
    taskId: chain.taskId,
    traceId: chain.traceId,
    taskRevision: chain.taskRevision,
    steps: Object.freeze([...chain.steps, receipt]),
    chainSha256,
  });
}


export async function assertPipelineReceiptChain(
  chain: PipelineReceiptChain,
  plan?: PipelinePlanIdentity,
): Promise<void> {
  if (chain.schemaVersion !== '1') throw new Error('Unsupported pipeline receipt chain schema version.');
  if (chain.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Pipeline receipt chain catalog fingerprint is stale.');
  if (!SHA256_PATTERN.test(chain.planFingerprint)) throw new Error('Pipeline receipt chain plan fingerprint is invalid.');
  if (!chain.taskId.trim() || !chain.traceId.trim()) throw new Error('Pipeline receipt chain task identity is missing.');
  if (!Number.isInteger(chain.taskRevision) || chain.taskRevision < 0) throw new Error('Pipeline receipt chain task revision is invalid.');
  if (plan) {
    const expectedPlanFingerprint = await createPipelinePlanFingerprint(plan);
    if (expectedPlanFingerprint !== chain.planFingerprint) throw new Error('Pipeline receipt chain plan fingerprint does not match the execution plan.');
  }
  let rebuilt = createPipelineReceiptChain(chain.catalogFingerprint, chain.planFingerprint, chain.taskId, chain.traceId, chain.taskRevision);
  for (const receipt of chain.steps) {
    rebuilt = await appendPipelineStepReceipt(rebuilt, receipt);
  }
  if (rebuilt.chainSha256 !== chain.chainSha256 || rebuilt.steps.length !== chain.steps.length) {
    throw new Error('Pipeline receipt chain digest or length mismatch.');
  }
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
  const tool = getToolById(input.toolId);
  if (!tool) throw new Error(`Unknown pipeline tool: ${input.toolId}`);
  if (!tool.operational.executorId) throw new Error(`Pipeline receipt execution binding is missing: ${input.toolId}`);
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
    executionMode: tool.executionMode,
    executorId: tool.operational.executorId,
  });
}
