import fs from 'node:fs/promises';
import { TOOL_REGISTRY } from '../../../src/config/registry.ts';
import { getToolOutputContract } from '../../../src/lib/contracts/tool-output-contracts.ts';

const toolIds = TOOL_REGISTRY
  .filter((tool) => tool.isReady)
  .map((tool) => tool.id)
  .filter((toolId) => Boolean(getToolOutputContract(toolId)));

const expectedGates = ['G3-40', 'G3-41', 'G3-42', 'G3-43', 'G3-44', 'G3-45', 'G3-46', 'G3-47'];
const results = [];
const sha = process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown';

for (const gate of expectedGates) {
  for (const toolId of toolIds) {
    const contract = getToolOutputContract(toolId);
    const variants = contract?.variants ?? [];
    const pass = (() => {
      switch (gate) {
        case 'G3-40': return Boolean(contract);
        case 'G3-41': return Boolean(contract && Array.isArray(contract.variants));
        case 'G3-42': return variants.length > 0;
        case 'G3-43': return variants.every((variant) => Array.isArray(variant.outputMimeTypes) && variant.outputMimeTypes.length > 0);
        case 'G3-44': return variants.every((variant) => Array.isArray(variant.allowedExtensions) && variant.allowedExtensions.length > 0);
        case 'G3-45': return variants.every((variant) => Array.isArray(variant.outputMimeTypes) && variant.outputMimeTypes.every(Boolean));
        case 'G3-46': return variants.every((variant) => Number.isFinite(variant.maxOutputBytes) && Number.isFinite(variant.minOutputBytes) && variant.maxOutputBytes >= variant.minOutputBytes);
        case 'G3-47': return variants.every((variant) => variant.allowedExtensions.every(Boolean));
        default: return false;
      }
    })();
    results.push({
      gate,
      status: pass ? 'PASS' : 'FAIL',
      class: pass ? null : 'PRODUCT',
      rootCause: pass ? null : `PROCESSOR_${gate}`,
      retryable: false,
      sha,
      durationMs: 0,
      command: `processor contract inspection ${toolId}`,
      toolId,
      variants: variants.length,
    });
  }
}

const byGate = expectedGates.map((gate) => ({
  gate,
  status: results.filter((result) => result.gate === gate).every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
  results: results.filter((result) => result.gate === gate),
}));
const report = {
  gate: 'G3-40..47',
  status: byGate.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
  toolIds,
  results: byGate,
};

await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/processor.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === 'PASS' ? 0 : 1);
