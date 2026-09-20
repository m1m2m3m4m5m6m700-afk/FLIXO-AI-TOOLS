#!/usr/bin/env node
import assert from 'node:assert/strict';
import { ImageAssetStore } from '../src/image-core/asset-store.ts';
import { ImageJob } from '../src/image-core/job.ts';

const store = new ImageAssetStore();
const inputBlob = new Blob(['input'], { type: 'image/png' });
const inputId = store.put({ blob: inputBlob, width: 2, height: 3, name: 'input.png' });

assert.equal(store.size, 1);
assert.equal(store.get(inputId)?.size, inputBlob.size);
assert.equal(store.require(inputId).mimeType, 'image/png');
assert.equal(store.require(inputId).width, 2);
assert.equal(store.require(inputId).height, 3);

const url = store.createObjectURL(inputId);
assert.match(url, /^blob:/);
assert.equal(store.createObjectURL(inputId), url);
store.revokeObjectURL(inputId);
assert.equal(store.delete(inputId), true);
assert.equal(store.get(inputId), undefined);
assert.equal(store.size, 0);

assert.throws(
  () => new ImageAssetStore().put({ blob: new Blob([], { type: 'image/png' }), width: 1, height: 1 }),
  /must not be empty/,
);

const jobStore = new ImageAssetStore();
const sourceId = jobStore.put({ blob: new Blob(['source'], { type: 'image/png' }), width: 8, height: 6, name: 'source.png' });
let verifiedOutputSize = 0;

const job = new ImageJob({
  toolId: 'image-converter',
  inputAssetId: sourceId,
  assetStore: jobStore,
  parameters: { format: 'image/webp' },
  processor: async (input) => ({
    blob: new Blob(['converted:' + input.size], { type: 'image/webp' }),
    width: input.width,
    height: input.height,
    name: 'converted.webp',
  }),
  verifier: async (input, output, parameters) => {
    verifiedOutputSize = output.size;
    return {
      valid: output.mimeType === parameters.format && output.width === input.width && output.height === input.height,
      failures: [],
    };
  },
});

const run = await job.run();
assert.equal(run.verification.valid, true);
assert.equal(verifiedOutputSize, run.result.output.size);
assert.equal(run.result.output.mimeType, 'image/webp');
assert.equal(run.result.output.name, 'converted.webp');
assert.equal(jobStore.size, 2);

const rejectedJob = new ImageJob({
  toolId: 'broken',
  inputAssetId: sourceId,
  assetStore: jobStore,
  processor: async () => ({ blob: new Blob([], { type: 'image/png' }), width: 1, height: 1 }),
});
await assert.rejects(() => rejectedJob.execute(), /produced an empty output/);

const failingJob = new ImageJob({
  toolId: 'unverified',
  inputAssetId: sourceId,
  assetStore: jobStore,
  processor: async (input) => ({ blob: new Blob(['output'], { type: 'image/png' }), width: input.width, height: input.height }),
  verifier: async () => false,
});
await assert.rejects(() => failingJob.run(), /verification failed/);
assert.equal(jobStore.size, 2, 'failed verification must remove its output asset');

const foreign = await job.execute();
await assert.rejects(() => job.verify({ ...foreign, toolId: 'other-tool' }), /does not belong/);

jobStore.clear();
assert.equal(jobStore.size, 0);

console.log('Image Platform runtime: PASS');
