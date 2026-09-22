#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const workflowDir=path.join(root,'.github','workflows');
const ciDir=path.join(root,'scripts','ci');
const offenders=[];
const readFiles=(dir,exts)=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);if(e.isDirectory())return readFiles(p,exts);return exts.some(x=>e.name.endsWith(x))?[p]:[];}):[];
function checkWorkflow(file){
  const c=fs.readFileSync(file,'utf8'); const rel=path.relative(root,file).replaceAll(path.sep,'/');
  if(/^\s*contents:\s*(?:write|write-all)\s*$/mu.test(c)) offenders.push({file:rel,reason:'WORKFLOW_CONTENTS_WRITE'});
  if(/\bgit\s+push\b/iu.test(c)) offenders.push({file:rel,reason:'WORKFLOW_GIT_PUSH'});
  if(/gh\s+api\s+--method\s+(?:POST|PUT|PATCH|DELETE)[^\n]*(?:\/git\/refs\/heads\/execution|\/contents\/)/iu.test(c)) offenders.push({file:rel,reason:'WORKFLOW_REMOTE_GIT_WRITE'});
  if(/(?:curl|wget)[^\n]*(?:\/git\/refs\/heads\/execution|\/contents\/)[^\n]*\b(?:POST|PUT|PATCH|DELETE)\b/iu.test(c)) offenders.push({file:rel,reason:'WORKFLOW_HTTP_GIT_WRITE'});
}
function checkCi(file){
  const c=fs.readFileSync(file,'utf8'); const rel=path.relative(root,file).replaceAll(path.sep,'/');
  if(/\bgit\s+push\b/iu.test(c)) offenders.push({file:rel,reason:'CI_GIT_PUSH'});
  if(/(?:github\.com|api\.github\.com)[^\n]*(?:\/git\/refs\/heads\/execution|\/contents\/)[^\n]*(?:method\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)|--method\s+(?:POST|PUT|PATCH|DELETE))/iu.test(c)) offenders.push({file:rel,reason:'CI_REMOTE_EXECUTION_WRITE'});
}
const workflowFiles=readFiles(workflowDir,['.yml','.yaml']);
const ciFiles=readFiles(ciDir,['.mjs']);
for(const file of workflowFiles) checkWorkflow(file);
for(const file of ciFiles) checkCi(file);
const result={authority:'BOUNDARY_VALIDATION_ONLY',branch:'execution',rule:'NO_DIRECT_PUSH_WITHOUT_CHAIR_AND_CONTROLLER',scanned:{workflows:workflowFiles.length,ciScripts:ciFiles.length},offenders,pass:offenders.length===0,checkedAt:new Date().toISOString()};
console.log(JSON.stringify(result,null,2));
if(offenders.length) process.exitCode=1;
