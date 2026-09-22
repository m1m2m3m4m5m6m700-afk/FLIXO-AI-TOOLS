import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SHA_RE=/^[a-f0-9]{40}$/iu;
const normalizeText=(v)=>String(v??'').replace(/\r\n?/g,'\n');
const shaOk=(v)=>SHA_RE.test(String(v??''));
const digest=(v)=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');

function git(cwd,args){return execFileSync('git',['-C',cwd,...args],{encoding:'utf8'});}
function gitTrim(cwd,args){return git(cwd,args).trim();}
function safePath(value){
  const p=String(value??'').trim().replace(/\\/g,'/').replace(/^\.\//u,'');
  if(!p||p.includes('\0')||p.startsWith('/')||p.split('/').includes('..')) throw new Error('CHAIR1_ACCUMULATOR_PATH_INVALID');
  return p;
}
function readGitFile(root,ref,file){
  try{return git(root,['show',ref+':'+file]);}catch{return null;}
}
function currentGitFile(root,file){
  const abs=path.join(root,file);
  return fs.existsSync(abs)?fs.readFileSync(abs,'utf8'):null;
}
function opFromStatus(status){
  if(status==='A')return 'CREATE';
  if(status==='D')return 'DELETE';
  return 'UPDATE';
}

export function captureWorkingTreeChange({
  repoRoot=process.cwd(),
  baseSha,
  executionSha,
  mainSha,
  agentId='unknown-agent',
  taskId='unknown-task',
  workPackageId=null,
  summary='',
}={}){
  if(!shaOk(baseSha)||!shaOk(executionSha)||!shaOk(mainSha)) throw new Error('CHAIR1_ACCUMULATOR_SHA_INVALID');
  const lines=gitTrim(repoRoot,['diff','--name-status',baseSha,'HEAD']).split('\n').filter(Boolean);
  const changes=lines.map(line=>{
    const parts=line.split('\t');
    const status=parts[0]?.[0]||'M';
    const file=safePath(parts.at(-1));
    const baseContent=readGitFile(repoRoot,baseSha,file);
    const candidateContent=currentGitFile(repoRoot,file);
    const operation=opFromStatus(status);
    if(operation==='CREATE'&&candidateContent===null) throw new Error('CHAIR1_ACCUMULATOR_CREATE_CONTENT_MISSING:'+file);
    if(operation!=='CREATE'&&baseContent===null) throw new Error('CHAIR1_ACCUMULATOR_BASE_CONTENT_MISSING:'+file);
    return Object.freeze({
      path:file,
      operation,
      baseContent:baseContent===null?null:normalizeText(baseContent),
      candidateContent:candidateContent===null?null:normalizeText(candidateContent),
      baseBlobSha:baseContent===null?null:digest(normalizeText(baseContent)),
      candidateBlobSha:candidateContent===null?null:digest(normalizeText(candidateContent)),
    });
  });
  if(!changes.length) throw new Error('CHAIR1_ACCUMULATOR_EMPTY_CHANGE');
  const packet={
    schemaVersion:1,
    protocol:'FLIXO-CHAIR1-CHANGE-ACCUMULATOR-v1',
    proposalId:digest({agentId,taskId,baseSha,executionSha,mainSha,changes:changes.map(x=>({path:x.path,operation:x.operation,candidateBlobSha:x.candidateBlobSha}))}),
    status:'PENDING_CHAIR1',
    authority:'CHAIR_1_DELEGATED_PUBLICATION_ONLY',
    mutationPolicy:'NO_AGENT_PUBLICATION',
    agentId:String(agentId),
    taskId:String(taskId),
    workPackageId:workPackageId?String(workPackageId):null,
    baseSha,
    executionSha,
    mainSha,
    candidateSha:gitTrim(repoRoot,['rev-parse','HEAD']),
    changes,
    summary:String(summary??'').slice(0,4000),
    capturedAt:new Date().toISOString(),
  };
  packet.packetDigest=digest(packet);
  return packet;
}

export function finalizeCandidateForChair1({
  repoRoot=process.cwd(),
  parentSha,
  candidateSha,
  currentExecutionSha,
  currentMainSha,
  agentId='CHAIR_1',
  taskId='unknown-task',
  workPackageId=null,
}={}){
  if(!shaOk(parentSha)||!shaOk(candidateSha)||!shaOk(currentExecutionSha)||!shaOk(currentMainSha)) throw new Error('CHAIR1_ACCUMULATOR_FINALIZE_SHA_INVALID');
  const head=gitTrim(repoRoot,['rev-parse','HEAD']);
  if(head!==candidateSha) throw new Error('CHAIR1_ACCUMULATOR_CANDIDATE_NOT_HEAD');
  if(currentExecutionSha===parentSha){
    return Object.freeze({status:'READY_TO_PUBLISH',candidateSha,parentSha,currentExecutionSha,currentMainSha,reconciled:false});
  }
  const before=gitTrim(repoRoot,['rev-parse','HEAD']);
  try{
    execFileSync('git',['-C',repoRoot,'rebase','--onto',currentExecutionSha,parentSha,candidateSha],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const rebasedSha=gitTrim(repoRoot,['rev-parse','HEAD']);
    return Object.freeze({
      status:'READY_TO_PUBLISH',
      candidateSha:rebasedSha,
      parentSha:currentExecutionSha,
      currentExecutionSha,
      currentMainSha,
      reconciled:true,
      reconciliation:'CHAIR1_AUTOMATIC_REBASE',
      priorCandidateSha:candidateSha,
      priorParentSha:parentSha,
    });
  }catch(error){
    try{execFileSync('git',['-C',repoRoot,'rebase','--abort'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{}
    const packet=captureWorkingTreeChange({
      repoRoot,
      baseSha:parentSha,
      executionSha:currentExecutionSha,
      mainSha:currentMainSha,
      agentId,
      taskId,
      workPackageId,
      summary:'Candidate could not be replayed cleanly; preserved for Chair-1 reconciliation.',
    });
    const out='/tmp/flixo-chair1-pending-change.json';
    fs.writeFileSync(out,JSON.stringify({...packet,status:'PENDING_CHAIR1_EDIT',rebaseError:String(error?.message??error),priorCandidateSha:candidateSha,priorParentSha:parentSha},null,2)+'\n');
    return Object.freeze({
      status:'PENDING_CHAIR1_EDIT',
      candidateSha:before,
      parentSha,
      currentExecutionSha,
      currentMainSha,
      reconciled:false,
      pendingPacket:out,
      packet,
      rebaseError:String(error?.message??error),
    });
  }
}

export function comparePendingToCurrent(packet,{currentExecutionSha,currentMainSha}={}){
  if(!packet||packet.protocol!=='FLIXO-CHAIR1-CHANGE-ACCUMULATOR-v1') throw new Error('CHAIR1_ACCUMULATOR_PACKET_INVALID');
  if(!shaOk(currentExecutionSha)||!shaOk(currentMainSha)) throw new Error('CHAIR1_ACCUMULATOR_CURRENT_SHA_INVALID');
  const executionChanged=packet.executionSha!==currentExecutionSha;
  const mainChanged=packet.mainSha!==currentMainSha;
  return Object.freeze({
    exactExecutionBase:!executionChanged,
    exactMainBase:!mainChanged,
    requiresReconciliation:executionChanged||mainChanged,
    state:executionChanged||mainChanged?'STALE_REQUIRES_CHAIR1_REBASE':'CURRENT_BASE',
    packetExecutionSha:packet.executionSha,
    packetMainSha:packet.mainSha,
    currentExecutionSha,
    currentMainSha,
  });
}

function mergeText({base,current,candidate,label}){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-chair1-merge-'));
  const basePath=path.join(tmp,'base');
  const currentPath=path.join(tmp,'current');
  const candidatePath=path.join(tmp,'candidate');
  fs.writeFileSync(basePath,normalizeText(base??''));
  fs.writeFileSync(currentPath,normalizeText(current??''));
  fs.writeFileSync(candidatePath,normalizeText(candidate??''));
  let merged='';
  let code=0;
  try{
    merged=execFileSync('git',['merge-file','-p',currentPath,basePath,candidatePath],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  }catch(error){
    code=Number(error?.status??1);
    merged=String(error?.stdout??'');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
  const conflict=/^<<<<<<< |^=======$|^>>>>>>> /m.test(merged);
  return {label,merged,status:code===0&&!conflict?'MERGED':'CONFLICT_NEEDS_CHAIR1_EDIT',conflict};
}

export function reconcilePendingChange(packet,{repoRoot=process.cwd(),currentExecutionSha,currentMainSha}={}){
  const identity=comparePendingToCurrent(packet,{currentExecutionSha,currentMainSha});
  const files=[];
  for(const change of packet.changes){
    const current=currentGitFile(repoRoot,change.path);
    if(change.operation==='CREATE'){
      if(current===null){
        files.push({...change,reconciledContent:change.candidateContent,status:'READY'});
      }else if(normalizeText(current)===normalizeText(change.candidateContent??'')){
        files.push({...change,reconciledContent:current,status:'READY_IDEMPOTENT'});
      }else{
        files.push({...change,reconciledContent:change.candidateContent,status:'CONFLICT_NEEDS_CHAIR1_EDIT',conflict:true});
      }
      continue;
    }
    if(change.operation==='DELETE'){
      if(current===null){files.push({...change,reconciledContent:null,status:'READY_IDEMPOTENT'});continue;}
      if(normalizeText(current)===normalizeText(change.baseContent??'')){
        files.push({...change,reconciledContent:null,status:'READY'});
      }else{
        files.push({...change,reconciledContent:current,status:'CONFLICT_NEEDS_CHAIR1_EDIT',conflict:true});
      }
      continue;
    }
    const merged=mergeText({
      base:change.baseContent,
      current,
      candidate:change.candidateContent,
      label:change.path,
    });
    files.push({...change,currentContent:current,reconciledContent:merged.merged,status:merged.status,conflict:merged.conflict});
  }
  const conflicts=files.filter(x=>x.status==='CONFLICT_NEEDS_CHAIR1_EDIT').map(x=>x.path);
  return Object.freeze({
    schemaVersion:1,
    protocol:'FLIXO-CHAIR1-RECONCILIATION-v1',
    proposalId:packet.proposalId,
    status:conflicts.length?'PENDING_CHAIR1_EDIT':'READY_TO_PUBLISH',
    identity,
    conflicts,
    files,
    currentExecutionSha,
    currentMainSha,
    generatedAt:new Date().toISOString(),
  });
}

export function editReconciledChange(reconciliation,{path:targetPath,content,editorAgent='MASTER-1',reason='CHAIR1_NORMALIZATION'}={}){
  const target=safePath(targetPath);
  const index=reconciliation.files.findIndex(x=>x.path===target);
  if(index<0) throw new Error('CHAIR1_ACCUMULATOR_EDIT_PATH_NOT_FOUND');
  const files=reconciliation.files.map((item,i)=>i===index?{...item,reconciledContent:normalizeText(content),status:'EDITED_BY_CHAIR1',conflict:false}:item);
  const conflicts=files.filter(x=>x.status==='CONFLICT_NEEDS_CHAIR1_EDIT').map(x=>x.path);
  return Object.freeze({
    ...reconciliation,
    status:conflicts.length?'PENDING_CHAIR1_EDIT':'READY_TO_PUBLISH',
    files,
    chair1Edits:[...(reconciliation.chair1Edits??[]),{path:target,editorAgent:String(editorAgent),reason:String(reason),editedAt:new Date().toISOString(),contentSha:digest(normalizeText(content))}],
  });
}

export function applyReconciliation(repoRoot,reconciliation){
  if(reconciliation.status!=='READY_TO_PUBLISH') throw new Error('CHAIR1_ACCUMULATOR_PUBLICATION_BLOCKED_PENDING_EDIT');
  for(const file of reconciliation.files){
    const abs=path.join(repoRoot,file.path);
    if(file.operation==='DELETE') fs.rmSync(abs,{force:true});
    else{
      fs.mkdirSync(path.dirname(abs),{recursive:true});
      fs.writeFileSync(abs,String(file.reconciledContent??''));
    }
  }
  return {status:'APPLIED',files:reconciliation.files.map(x=>x.path)};
}

export function queuePacket(packet,{queueFile}={}){
  if(!queueFile) throw new Error('CHAIR1_ACCUMULATOR_QUEUE_PATH_REQUIRED');
  fs.mkdirSync(path.dirname(queueFile),{recursive:true});
  const line=JSON.stringify(packet)+'\n';
  fs.appendFileSync(queueFile,line);
  return {queued:true,proposalId:packet.proposalId,queueFile};
}

if(process.argv[1]?.endsWith('/chair1-change-accumulator.mjs')){
  const [, , command, ...rest]=process.argv;
  const args=new Map();
  for(let i=0;i<rest.length;i+=1){
    const token=rest[i];if(!token.startsWith('--'))continue;
    const eq=token.indexOf('=');const key=token.slice(2,eq>=0?eq:undefined);
    const value=eq>=0?token.slice(eq+1):(rest[i+1]??'');args.set(key,value);
  }
  const arg=(name,fallback='')=>String(args.get(name)??fallback).trim();
  if(command==='capture'){
    const packet=captureWorkingTreeChange({
      repoRoot:arg('repo-root',process.cwd()),
      baseSha:arg('base-sha'),
      executionSha:arg('execution-sha',arg('base-sha')),
      mainSha:arg('main-sha',arg('base-sha')),
      agentId:arg('agent','unknown-agent'),
      taskId:arg('task','unknown-task'),
      workPackageId:arg('work-package')||null,
      summary:arg('summary'),
    });
    const out=arg('output','/tmp/flixo-chair1-pending-change.json');
    fs.writeFileSync(out,JSON.stringify(packet,null,2)+'\n');
    console.log(JSON.stringify({status:packet.status,proposalId:packet.proposalId,output:out,files:packet.changes.map(x=>x.path)},null,2));
  }else if(command==='finalize'){
    const result=finalizeCandidateForChair1({
      repoRoot:arg('repo-root',process.cwd()),
      parentSha:arg('parent-sha'),
      candidateSha:arg('candidate-sha'),
      currentExecutionSha:arg('execution-sha'),
      currentMainSha:arg('main-sha'),
      agentId:arg('agent','CHAIR_1'),
      taskId:arg('task','unknown-task'),
      workPackageId:arg('work-package')||null,
    });
    const out=arg('output','/tmp/flixo-chair1-finalize.json');
    fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({status:result.status,candidateSha:result.candidateSha,pendingPacket:result.pendingPacket??null,output:out},null,2));
  }else if(command==='reconcile'){
    const packet=JSON.parse(fs.readFileSync(arg('packet'),'utf8'));
    const result=reconcilePendingChange(packet,{repoRoot:arg('repo-root',process.cwd()),currentExecutionSha:arg('execution-sha'),currentMainSha:arg('main-sha')});
    const out=arg('output','/tmp/flixo-chair1-reconciliation.json');
    fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({status:result.status,proposalId:result.proposalId,conflicts:result.conflicts,output:out},null,2));
  }else{
    throw new Error('Usage: chair1-change-accumulator.mjs capture|reconcile|finalize');
  }
}
