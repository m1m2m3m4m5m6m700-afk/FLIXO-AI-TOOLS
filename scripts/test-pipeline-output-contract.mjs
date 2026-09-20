#!/usr/bin/env node
import assert from 'node:assert/strict';
import { getToolOutputContractForDefinition } from '../src/lib/contracts/tool-output-contracts.ts';
import { getToolDefinition } from '../src/config/canonical-tool-definition.ts';
import { verifyPipelineOutput } from '../src/lib/workflows/pipeline-runner.ts';
import { createPipelineStepReceipt } from '../src/lib/workflows/pipeline-receipt.ts';
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

console.log('Pipeline output contract + artifact receipt tests passed.');
