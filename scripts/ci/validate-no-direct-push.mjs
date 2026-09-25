#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { SENSITIVE_PERMISSION_ALLOWLISTS } from './control-plane-registry.mjs';

const root=process.cwd();
const workflowDir=path.join(root,'.github','workflows');
const ciDir=path.join(root,'scripts','ci');
const offenders=[];
const readFiles=(dir,exts)=>fs.existsSync(dir)
  ? fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
      const p=path.join(dir,e.name);
      if(e.isDirectory()) return readFiles(p,exts);
      return exts.some(x=>e.name.endsWith(x))?[p]:[];
    })
  : [];
const relPath=(file)=>path.relative(root,file).replaceAll(path.sep,'/');
const workflowName=(file)=>path.basename(file);
const contentsWriteAllowlist=new Set(SENSITIVE_PERMISSION_ALLOWLISTS.contents ?? []);
const EXECUTION_PUBLICATION_WORKFLOW='agent-repair-handoff-gate.yml';
const LEASE_CONTROL_WORKFLOW='daily-flixo-green-gate.yml';

function add(file,reason,detail=null){offenders.push({file:relPath(file),reason,...(detail?{detail}:{})});}
function hasContentsWrite(c){return /^\s*contents:\s*(?:write|write-all)\s*$/mu.test(c);}
function hasExecutionHeadWrite(c){
  return /(?:gh\s+api|curl|wget)[^\n]*(?:git\/refs\/heads\/execution|refs\/heads\/execution)[^\n]*(?:POST|PUT|PATCH|DELETE)/iu.test(c)
    || /(?:gh\s+api|curl|wget)[^\n]*(?:POST|PUT|PATCH|DELETE)[^\n]*(?:git\/refs\/heads\/execution|refs\/heads\/execution)/iu.test(c);
}
function checkWorkflow(file){
  const c=fs.readFileSync(file,'utf8');
  const name=workflowName(file);
  if(hasContentsWrite(c) && !contentsWriteAllowlist.has(name)) add(file,'WORKFLOW_CONTENTS_WRITE_NOT_ALLOWLISTED');
  if(/\bgit\s+push\b/iu.test(c)) add(file,'WORKFLOW_GIT_PUSH');
  if(hasExecutionHeadWrite(c) && name!==EXECUTION_PUBLICATION_WORKFLOW) add(file,'WORKFLOW_REMOTE_EXECUTION_WRITE_NOT_ALLOWLISTED');
  if(name===EXECUTION_PUBLICATION_WORKFLOW){
    const guardedPublication =
      hasContentsWrite(c) &&
      /git\/refs\/heads\/execution/iu.test(c) &&
      /--method\s+PATCH/iu.test(c) &&
      /force=false/iu.test(c) &&
      /execution-mutation-gate\.mjs\s+verify/iu.test(c) &&
      /execution-head-authority\.mjs\s+verify/iu.test(c) &&
      !/git\/refs\/heads\/main/iu.test(c);
    if(!guardedPublication) add(file,'EXECUTION_PUBLICATION_GUARD_INCOMPLETE');
  }
  if(name===LEASE_CONTROL_WORKFLOW){
    const leaseWriteIsScoped =
      hasContentsWrite(c) &&
      /repair-lease\.mjs/iu.test(c) &&
      /refs\/tags\/flixo-repair-lease-/iu.test(c) &&
      !/git\/refs\/heads\/execution/iu.test(c) &&
      !/git\/refs\/heads\/main/iu.test(c);
    if(!leaseWriteIsScoped) add(file,'LEASE_CONTROL_WRITE_SCOPE_INVALID');
  }
  if(/(?:curl|wget)[^\n]*(?:\/git\/refs\/heads\/execution|\/contents\/)[^\n]*\b(?:POST|PUT|PATCH|DELETE)\b/iu.test(c) && name!==EXECUTION_PUBLICATION_WORKFLOW){
    add(file,'WORKFLOW_HTTP_GIT_WRITE_NOT_ALLOWLISTED');
  }
}
function checkCi(file){
  const c=fs.readFileSync(file,'utf8');
  if(/\bgit\s+push\b/iu.test(c)) add(file,'CI_GIT_PUSH');
  if(/(?:github\.com|api\.github\.com)[^\n]*(?:\/git\/refs\/heads\/execution|\/contents\/)[^\n]*(?:method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)|--method\s+(?:POST|PUT|PATCH|DELETE))/iu.test(c)){
    add(file,'CI_REMOTE_EXECUTION_WRITE');
  }
}
const workflowFiles=readFiles(workflowDir,['.yml','.yaml']);
const ciFiles=readFiles(ciDir,['.mjs']);
for(const file of workflowFiles) checkWorkflow(file);
for(const file of ciFiles) checkCi(file);
const result={
  authority:'BOUNDARY_VALIDATION_ONLY',
  branch:'execution',
  rule:'NO_DIRECT_PUSH_WITHOUT_CHAIR_AND_CONTROLLER',
  allowlist:{contentsWrite:[...contentsWriteAllowlist].sort(),executionPublicationWorkflow:EXECUTION_PUBLICATION_WORKFLOW,leaseControlWorkflow:LEASE_CONTROL_WORKFLOW},
  scanned:{workflows:workflowFiles.length,ciScripts:ciFiles.length},
  offenders,pass:offenders.length===0,checkedAt:new Date().toISOString()
};
console.log(JSON.stringify(result,null,2));
if(offenders.length) process.exitCode=1;
