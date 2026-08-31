import fs from 'node:fs/promises';
import { getToolOutputContract } from '../../../src/lib/contracts/tool-output-contracts';
const contracts = ['image-compressor','image-compressor-batch'];
const results = contracts.map((toolId) => {
  const contract = getToolOutputContract(toolId);
  return { gate: `G3-4x-${toolId}`, status: contract ? 'PASS' : 'FAIL', toolId, variants: contract?.variants?.length ?? 0 };
});
const report={gate:'G3-40-47',status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',results};
await fs.mkdir('artifacts/ci/g3',{recursive:true});
await fs.writeFile('artifacts/ci/g3/processor.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exit(report.status==='PASS'?0:1);
