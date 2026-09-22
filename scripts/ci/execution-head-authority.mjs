#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { activeChairForAgent } from './chair-bound-execution.mjs';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const SHA_RE=/^[a-f0-9]{40}$/u;
const hash=v=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const git=args=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sha=v=>{const s=String(v??'').trim();if(!SHA_RE.test(s))throw new Error('CHAIR1_HEAD_AUTHORITY_SHA_INVALID');return s;};

export const HEAD_AUTHORITY_PROTOCOL='FLIXO-CHAIR1-EXECUTION-HEAD-AUTHORITY-v1';

export function authorizeExecutionHead({agentId,targetSha,candidateSha,parentSha,taskId,workPackageId,output='/tmp/flixo-head-authority.json'}={}) {
  const target=sha(targetSha);
  const candidate=sha(candidateSha ?? target);
  const parent=sha(parentSha ?? target);
  if(parent!==target) throw new Error('CHAIR1_HEAD_AUTHORITY_PARENT_MISMATCH');
  if(candidate===target) throw new Error('CHAIR1_HEAD_AUTHORITY_EMPTY_CANDIDATE');
  const active=activeChairForAgent({agentId,targetSha:target});
  if(!active || active.chairId!=='chair_1') throw new Error('EXECUTION_HEAD_CHANGE_REQUIRES_CHAIR1');
  if(active.taskId!==null && taskId!==null && String(active.taskId)!==String(taskId)) throw new Error('CHAIR1_HEAD_AUTHORITY_TASK_MISMATCH');
  if(active.workPackageId!==null && workPackageId!==null && String(active.workPackageId)!==String(workPackageId)) throw new Error('CHAIR1_HEAD_AUTHORITY_WORK_PACKAGE_MISMATCH');
  if(git(['rev-parse','HEAD'])!==target) throw new Error('CHAIR1_HEAD_AUTHORITY_STALE_LOCAL_HEAD');
  const proof={
    schemaVersion:1,
    protocol:HEAD_AUTHORITY_PROTOCOL,
    authorized:true,
    chairId:'chair_1',
    agentId:String(agentId),
    leaseId:active.leaseId,
    taskId:String(taskId??active.taskId??''),
    workPackageId:String(workPackageId??active.workPackageId??''),
    targetSha:target,
    parentSha:parent,
    candidateSha:candidate,
    exactSha:true,
    proofDigest:hash(JSON.stringify({protocol:HEAD_AUTHORITY_PROTOCOL,chairId:'chair_1',agentId:String(agentId),leaseId:active.leaseId,taskId:String(taskId??active.taskId??''),workPackageId:String(workPackageId??active.workPackageId??''),targetSha:target,parentSha:parent,candidateSha:candidate})),
    createdAt:new Date().toISOString()
  };
  fs.mkdirSync(output.includes('/')?output.slice(0,output.lastIndexOf('/')):'.',{recursive:true});
  fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
  return proof;
}

export function verifyExecutionHeadAuthority({file='/tmp/flixo-head-authority.json',targetSha,parentSha,candidateSha}={}) {
  if(!fs.existsSync(file)) throw new Error('CHAIR1_HEAD_AUTHORITY_PROOF_MISSING');
  const proof=JSON.parse(fs.readFileSync(file,'utf8'));
  if(proof.schemaVersion!==1||proof.protocol!==HEAD_AUTHORITY_PROTOCOL) throw new Error('CHAIR1_HEAD_AUTHORITY_PROOF_INVALID');
  if(proof.authorized!==true||proof.chairId!=='chair_1'||proof.exactSha!==true) throw new Error('EXECUTION_HEAD_CHANGE_REQUIRES_CHAIR1');
  if(proof.targetSha!==sha(targetSha)||proof.parentSha!==sha(parentSha)||proof.candidateSha!==sha(candidateSha)) throw new Error('CHAIR1_HEAD_AUTHORITY_SHA_MISMATCH');
  if(proof.parentSha!==proof.targetSha) throw new Error('CHAIR1_HEAD_AUTHORITY_PARENT_MISMATCH');
  if(proof.candidateSha===proof.targetSha) throw new Error('CHAIR1_HEAD_AUTHORITY_EMPTY_CANDIDATE');
  if(!String(proof.leaseId??'').length) throw new Error('CHAIR1_HEAD_AUTHORITY_LEASE_MISSING');
  return proof;
}

if(process.argv[1]?.endsWith('execution-head-authority.mjs')){
  const args=new Map();
  for(let i=2;i<process.argv.length;i+=1){const t=process.argv[i];if(!t.startsWith('--'))continue;const e=t.indexOf('=');args.set(t.slice(2,e>=0?e:undefined),e>=0?t.slice(e+1):(process.argv[i+1]??''));}
  const arg=(n,d='')=>String(args.get(n)??d).trim();
  const command=String(process.argv[2]??'').toLowerCase();
  if(command==='authorize'){
    console.log(JSON.stringify(authorizeExecutionHead({
      agentId:arg('agent'),
      targetSha:arg('target-sha'),
      candidateSha:arg('candidate-sha'),
      parentSha:arg('parent-sha'),
      taskId:arg('task-id'),
      workPackageId:arg('work-package'),
      output:arg('output','/tmp/flixo-head-authority.json')
    }),null,2));
  } else if(command==='verify'){
    console.log(JSON.stringify(verifyExecutionHeadAuthority({
      file:arg('proof','/tmp/flixo-head-authority.json'),
      targetSha:arg('target-sha'),
      parentSha:arg('parent-sha'),
      candidateSha:arg('candidate-sha')
    }),null,2));
  } else throw new Error('Usage: execution-head-authority.mjs authorize|verify');
}
