import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const domains = {
  'G3-10-dependencies': ['npm','ci','--prefer-offline','--no-audit','--no-fund'],
  'G3-11-typescript': ['npx','tsc','--noEmit','--pretty','false'],
  'G3-12-eslint': ['npm','run','lint'],
  'G3-13-build': ['npm','run','build'],
  'G3-20-31-artifact': ['node','--experimental-strip-types','scripts/test-g3-artifact-integrity.mjs'],
  'G3-46-output': ['node','--experimental-strip-types','scripts/test-output-integrity.mjs'],
  'G3-22-svg': ['node','--experimental-strip-types','scripts/test-svg-integrity.mjs'],
};
const run = ([cmd,...args]) => new Promise((resolve) => { const p=spawn(cmd,args,{stdio:['ignore','pipe','pipe'],env:process.env}); let out='',err=''; p.stdout.on('data',d=>out+=d); p.stderr.on('data',d=>err+=d); p.on('close',code=>resolve({code:code??1,out,err})); p.on('error',e=>resolve({code:1,out,err:String(e)})); });
await fs.mkdir('artifacts/ci/g3/gates',{recursive:true});
const results=[];
for (const [gate,command] of Object.entries(domains)) {
  const started=Date.now(); const r=await run(command); const result={gate,status:r.code===0?'PASS':'FAIL',class:r.code===0?null:'PRODUCT_OR_CI',rootCause:r.code===0?null:gate,command:command.join(' '),durationMs:Date.now()-started};
  await fs.writeFile(`artifacts/ci/g3/gates/${gate}.json`,JSON.stringify({...result,stdout:r.out,stderr:r.err},null,2)+'\n');
  console.log(`[${result.status}] ${gate}`); if(r.out) console.log(r.out); if(r.err) console.error(r.err); results.push(result);
}
await fs.writeFile('artifacts/ci/g3/gates/index.json',JSON.stringify({results},null,2)+'\n');
if(results.some(r=>r.status==='FAIL')) process.exit(1);
