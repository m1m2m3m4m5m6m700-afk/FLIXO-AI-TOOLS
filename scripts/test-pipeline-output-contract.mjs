#!/usr/bin/env node
import assert from 'node:assert/strict';
import { getToolOutputContractForDefinition } from '../src/lib/contracts/tool-output-contracts.ts';
import { getToolDefinition } from '../src/config/canonical-tool-definition.ts';
import { verifyPipelineOutput } from '../src/lib/workflows/pipeline-runner.ts';

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

console.log('Pipeline output contract tests passed.');
