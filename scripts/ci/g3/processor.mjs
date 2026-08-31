import fs from 'node:fs/promises';
import { getToolOutputContract } from '../../../src/lib/contracts/tool-output-contracts.ts';

const toolIds = ['image-compressor', 'image-compressor-batch'];
const expectedGates = ['G3-40', 'G3-41', 'G3-42', 'G3-43', 'G3-44', 'G3-45', 'G3-46', 'G3-47'];
const results = [];

for (const gate of expectedGates) {
  for (const toolId of toolIds) {
    const contract = getToolOutputContract(toolId);
    const variants = contract?.variants ?? [];
    let pass = false;
    switch (gate) {
      case 'G3-40': pass = Boolean(contract); break;
      case 'G3-41': pass = Boolean(contract?.rejectionPolicy || contract?.variants); break;
      case 'G3-42': pass = variants.length > 0; break;
      case 'G3-43': pass = Boolean(contract?.errorContract || contract?.rejectionPolicy || contract?.variants); break;
      case 'G3-44': pass = variants.some(v => Array.isArray(v.allowedExtensions) && v.allowedExtensions.length > 0); break;
      case 'G3-45': pass = variants.some(v => Array.isArray(v.allowedMime) && v.allowedMime.length > 0); break;
      case 'G3-46': pass = variants.some(v => Number.isFinite(v.maxBytes) || Number.isFinite(v.minBytes) || v.signatures); break;
      case 'G3-47': pass = variants.some(v => Array.isArray(v.allowedExtensions) && v.allowedExtensions.every(Boolean)); break;
      default: pass = false;
    }
    const result = {
      gate, status: pass ? 'PASS' : 'FAIL', class: pass ? null : 'PRODUCT',
      rootCause: pass ? null : `PROCESSOR_${gate}`, retryable: false,
      sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown',
      durationMs: 0, command: `processor contract inspection ${toolId}`,
      toolId, variants: variants.length,
    };
    results.push(result);
  }
}

const byGate = expectedGates.map(gate => ({
  gate,
  status: results.filter(r => r.gate === gate).every(r => r.status === 'PASS') ? 'PASS' : 'FAIL',
  results: results.filter(r => r.gate === gate),
}));
const report = { gate: 'G3-40..47', status: byGate.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', results: byGate };
await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/processor.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === 'PASS' ? 0 : 1);
