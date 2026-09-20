#!/usr/bin/env node
import assert from 'node:assert/strict';
import { getToolOutputContractForDefinition } from '../src/lib/contracts/tool-output-contracts.ts';
import { getToolDefinition } from '../src/config/canonical-tool-definition.ts';
import { verifyPipelineOutput } from '../src/lib/workflows/pipeline-runner.ts';
import { appendPipelineStepReceipt, assertPipelineReceiptChain, createPipelinePlanFingerprint, createPipelineReceiptChain, createPipelineStepReceipt } from '../src/lib/workflows/pipeline-receipt.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';

const input = new Blob(['input'], { type: 'image/png' });
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const validPng = new Blob([pngBytes], { type: 'image/png' });
const invalidSignature = new Blob([new Uint8Array(9)], { type: 'image/png' });
const wrongMime = new Blob([pngBytes], { type: 'text/plain' });

const compressor = getToolDefinition('image-compressor');
assert.ok(compressor);
assert.ok(getToolOutputContractForDefinition(compressor));

assert.equal(
  await verifyPipelineOutput('image-compressor', input, validPng, { quality: 0.8 }),
  true,
);

assert.equal(
  await verifyPipelineOutput('image-compressor', input, invalidSignature, { quality: 0.8 }),
  false,
);

assert.equal(
  await verifyPipelineOutput('image-compressor', input, wrongMime, { quality: 0.8 }),
  false,
);

assert.equal(
  await verifyPipelineOutput('photo-colorizer', input, validPng, {}),
  false,
);

const receipt = await createPipelineStepReceipt({
  toolId: 'image-compressor',
  stepIndex: 1,
  attempt: 0,
  inputBlob: input,
  outputBlob: validPng,
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  verified: true,
});
assert.match(receipt.inputSha256, /^[a-f0-9]{64}$/);
assert.match(receipt.outputSha256, /^[a-f0-9]{64}$/);
assert.equal(receipt.recoveryApplied, false);
assert.equal(receipt.verified, true);

const plan = {
  workflowName: 'Receipt chain test',
  confidence: 0.91,
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  steps: [
    { toolId: 'image-compressor', params: { quality: 0.8 } },
    { toolId: 'image-compressor', params: { quality: 0.7 } },
  ],
};
const planFingerprint = await createPipelinePlanFingerprint(plan);
assert.match(planFingerprint, /^[a-f0-9]{64}$/);
const reorderedPlanFingerprint = await createPipelinePlanFingerprint({
  ...plan,
  steps: [
    { toolId: 'image-compressor', params: { quality: 0.7 } },
    { toolId: 'image-compressor', params: { quality: 0.8 } },
  ],
});
assert.notEqual(planFingerprint, reorderedPlanFingerprint);

let receiptChain = createPipelineReceiptChain(TOOL_CATALOG.fingerprint, planFingerprint);
assert.equal(receiptChain.planFingerprint, planFingerprint);
receiptChain = await appendPipelineStepReceipt(receiptChain, receipt);
assert.equal(receiptChain.steps.length, 1);
assert.match(receiptChain.chainSha256, /^[a-f0-9]{64}$/);

const secondReceipt = await createPipelineStepReceipt({
  toolId: 'image-compressor',
  stepIndex: 2,
  attempt: 1,
  inputBlob: validPng,
  outputBlob: validPng,
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  verified: true,
});
receiptChain = await appendPipelineStepReceipt(receiptChain, secondReceipt);
assert.equal(receiptChain.steps.length, 2);
assert.equal(receiptChain.steps[1].inputSha256, receiptChain.steps[0].outputSha256);
assert.equal(receiptChain.steps[1].recoveryApplied, true);
await assertPipelineReceiptChain(receiptChain, plan);
await assert.rejects(
  () => assertPipelineReceiptChain(receiptChain, {
    ...plan,
    confidence: 0.92,
  }),
  /does not match the execution plan/,
);

const tamperedPlanChain = Object.freeze({ ...receiptChain, planFingerprint: 'f'.repeat(64) });
await assert.rejects(
  () => assertPipelineReceiptChain(tamperedPlanChain),
  /plan fingerprint/,
);

const tamperedChain = Object.freeze({ ...receiptChain, chainSha256: 'f'.repeat(64) });
await assert.rejects(
  () => assertPipelineReceiptChain(tamperedChain),
  /digest or length mismatch/,
);

const brokenReceipt = await createPipelineStepReceipt({
  toolId: 'image-compressor',
  stepIndex: 3,
  attempt: 0,
  inputBlob: input,
  outputBlob: validPng,
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  verified: true,
});
await assert.rejects(
  () => appendPipelineStepReceipt(receiptChain, brokenReceipt),
  /artifact linkage is broken/,
);

console.log('Pipeline output contract + artifact receipt tests passed.');
