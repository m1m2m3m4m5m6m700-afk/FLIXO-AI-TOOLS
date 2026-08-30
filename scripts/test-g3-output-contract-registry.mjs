import assert from 'node:assert/strict';
import { TOOL_REGISTRY } from '../src/config/registry.ts';
import { TOOL_OUTPUT_CONTRACTS, assertReadyToolsHaveOutputContracts } from '../src/lib/contracts/tool-output-contracts.ts';

const ready = TOOL_REGISTRY.filter((tool) => tool.isReady);
assert.equal(ready.length, 46, `Unexpected ready-tool count: ${ready.length}`);
assert.doesNotThrow(() => assertReadyToolsHaveOutputContracts());

const readyIds = new Set(ready.map((tool) => tool.id));
const contractIds = new Set(Object.keys(TOOL_OUTPUT_CONTRACTS));
assert.deepEqual([...contractIds].sort(), [...readyIds].sort(), 'Ready tools and output contracts must have exact ID parity');

let variantCount = 0;
for (const tool of ready) {
  const contract = TOOL_OUTPUT_CONTRACTS[tool.id];
  assert.ok(contract, `Missing output contract: ${tool.id}`);
  assert.equal(contract.toolId, tool.id, `Output contract ownership drift: ${tool.id}`);
  assert.ok(contract.variants.length > 0, `Output contract has no variants: ${tool.id}`);
  const variantKeys = new Set();
  for (const variant of contract.variants) {
    variantCount += 1;
    assert.ok(variant.outputMimeTypes.length > 0, `${tool.id}/${variant.kind}: MIME set is empty`);
    assert.ok(variant.allowedExtensions.length > 0, `${tool.id}/${variant.kind}: extension set is empty`);
    assert.ok(Number.isInteger(variant.minOutputBytes) && variant.minOutputBytes >= 1, `${tool.id}/${variant.kind}: invalid minOutputBytes`);
    assert.ok(Number.isInteger(variant.maxOutputBytes) && variant.maxOutputBytes >= variant.minOutputBytes, `${tool.id}/${variant.kind}: invalid maxOutputBytes`);
    for (const mime of variant.outputMimeTypes) assert.ok(typeof mime === 'string' && mime.includes('/'), `${tool.id}/${variant.kind}: invalid MIME ${mime}`);
    for (const ext of variant.allowedExtensions) assert.match(ext, /^[a-z0-9]+$/u, `${tool.id}/${variant.kind}: invalid extension ${ext}`);
    const key = `${variant.kind}:${variant.outputMimeTypes.join(',')}:${variant.allowedExtensions.join(',')}`;
    assert.ok(!variantKeys.has(key), `${tool.id}: duplicate output variant`);
    variantKeys.add(key);
  }
}

const outputProducingFamilies = new Set(['image', 'pdf', 'audio', 'video', 'ai', 'other']);
for (const tool of ready) assert.ok(outputProducingFamilies.size > 0 && TOOL_OUTPUT_CONTRACTS[tool.id], `Ready output-producing tool lacks contract: ${tool.id}`);

console.log(`G3 contract registry PASS: readyTools=${ready.length} contracts=${contractIds.size} variants=${variantCount}`);
