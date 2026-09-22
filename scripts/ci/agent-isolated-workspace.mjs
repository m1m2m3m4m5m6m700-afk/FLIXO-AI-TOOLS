import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SHA_RE=/^[a-f0-9]{40}$/iu;
const ROOT=process.cwd();
const WORKSPACE_ROOT=()=>path.resolve(process.env.FLIXO_AGENT_WORKSPACE_ROOT ?? path.join(os.tmpdir(),'flixo-agent-workspaces'));
const sha256=(v)=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const shaOk=(v)=>SHA_RE.test(String(v??''));
function git(cwd,args){return execFileSync('git',['-C',cwd,...args],{encoding:'utf8'});}
function gitTrim(cwd,args){return git(cwd,args).trim();}
function id(value){return String(value??'').trim().replace(/[^A-Za-z0-9._:-]/g,'-').slice(0,180)||'agent-task';}

export function readCanonicalSnapshot(repoRoot=ROOT){
  const executionSha=gitTrim(repoRoot,['rev-parse','execution']);
  const mainSha=gitTrim(repoRoot,['rev-parse','main']);
  return Object.freeze({
    executionSha,
    mainSha,
    capturedAt:new Date().toISOString(),
    topology:'execution→main',
  });
}

export function createAgentWorkspace({
  repoRoot=ROOT,
  agentId,
  taskId,
  baseSha,
  executionSha,
  mainSha,
  workspaceRoot=WORKSPACE_ROOT(),
}={}){
  if(!shaOk(baseSha)||!shaOk(executionSha)||!shaOk(mainSha)) throw new Error('AGENT_WORKSPACE_SHA_INVALID');
  if(baseSha!==executionSha) throw new Error('AGENT_WORKSPACE_BASE_MUST_EQUAL_ENTRY_EXECUTION');
  const workspace=path.join(workspaceRoot,id(agentId),id(taskId));
  fs.mkdirSync(path.dirname(workspace),{recursive:true});
  if(fs.existsSync(workspace)) throw new Error('AGENT_WORKSPACE_ALREADY_EXISTS');
  execFileSync('git',['-C',repoRoot,'worktree','add','--detach',workspace,baseSha],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const meta={
    schemaVersion:1,
    protocol:'FLIXO-AGENT-ISOLATED-WORKSPACE-v1',
    workspaceId:sha256(JSON.stringify({agentId,taskId,baseSha,executionSha,mainSha,workspace})),
    agentId:String(agentId),
    taskId:String(taskId),
    workspace,
    baseSha,
    executionSha,
    mainSha,
    workspaceBranch:null,
    detached:true,
    tracksBranchHead:false,
    relationToBranch:'ENTRY_SNAPSHOT_ONLY',
    canCommit:false,
    canPush:false,
    publicationAuthority:'CHAIR_1',
    mutationAuthority:'WORKSPACE_ONLY',
    createdAt:new Date().toISOString(),
  };
  fs.writeFileSync(path.join(workspace,'.flixo-workspace.json'),JSON.stringify(meta,null,2)+'\n');
  return Object.freeze(meta);
}

export function assertWorkspaceIsolation({repoRoot=ROOT,workspace,entrySha}={}){
  if(!workspace||!fs.existsSync(workspace)) throw new Error('AGENT_WORKSPACE_MISSING');
  const current=gitTrim(workspace,['rev-parse','HEAD']);
  if(!shaOk(entrySha)||current!==entrySha) throw new Error('AGENT_WORKSPACE_ENTRY_SHA_DRIFT');
  const branch=gitTrim(workspace,['branch','--show-current']);
  if(branch) throw new Error('AGENT_WORKSPACE_MUST_REMAIN_DETACHED');
  return Object.freeze({
    isolated:true,
    workspace,
    entrySha,
    currentSha:current,
    detached:true,
    tracksBranchHead:false,
  });
}

export function captureAgentResult({
  repoRoot=ROOT,
  workspace,
  agentId,
  taskId,
  entrySha,
  executionSha,
  mainSha,
  summary='',
  status='READY_FOR_CHAIR1',
}={}){
  assertWorkspaceIsolation({repoRoot,workspace,entrySha});
  const patch=git(workspace,['diff','--binary',entrySha,'HEAD']);
  const changed=git(workspace,['diff','--name-only',entrySha,'HEAD']).trim().split('\n').filter(Boolean).sort();
  const diffCheck=(()=>{try{git(workspace,['diff','--check',entrySha,'HEAD']);return true;}catch{return false;}})();
  const result={
    schemaVersion:1,
    protocol:'FLIXO-AGENT-RESULT-v1',
    status,
    resultId:sha256(JSON.stringify({agentId,taskId,entrySha,executionSha,mainSha,changed,patch})),
    agentId:String(agentId),
    taskId:String(taskId),
    workspace,
    entrySha,
    executionSha,
    mainSha,
    currentWorkspaceSha:gitTrim(workspace,['rev-parse','HEAD']),
    changedFiles:changed,
    patchSha256:sha256(patch),
    patch,
    diffCheckPassed:diffCheck,
    tracksBranchHead:false,
    branchRelation:'ENTRY_SNAPSHOT_ONLY',
    editableBy:'CHAIR_1',
    publicationAuthority:'CHAIR_1',
    agentPublicationAllowed:false,
    summary:String(summary??'').slice(0,4000),
    capturedAt:new Date().toISOString(),
  };
  if(!diffCheck) throw new Error('AGENT_RESULT_DIFF_CHECK_FAILED');
  return Object.freeze(result);
}

export function cleanupAgentWorkspace({repoRoot=ROOT,workspace,force=false}={}){
  if(!workspace||!fs.existsSync(workspace)) return {removed:false,workspace};
  execFileSync('git',['-C',repoRoot,'worktree','remove',...(force?['--force']:[]),workspace],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return {removed:true,workspace};
}

if(process.argv[1]?.endsWith('/agent-isolated-workspace.mjs')){
  const [, , command, ...rest]=process.argv;
  const args=new Map();
  for(let i=0;i<rest.length;i+=1){
    const token=rest[i];if(!token.startsWith('--'))continue;
    const eq=token.indexOf('=');const k=token.slice(2,eq>=0?eq:undefined);const v=eq>=0?token.slice(eq+1):(rest[i+1]??'');args.set(k,v);
  }
  const arg=(n,f='')=>String(args.get(n)??f).trim();
  if(command==='snapshot') console.log(JSON.stringify(readCanonicalSnapshot(arg('repo-root',ROOT)),null,2));
  else if(command==='create'){
    const result=createAgentWorkspace({repoRoot:arg('repo-root',ROOT),agentId:arg('agent'),taskId:arg('task'),baseSha:arg('base-sha'),executionSha:arg('execution-sha'),mainSha:arg('main-sha'),workspaceRoot:arg('workspace-root',WORKSPACE_ROOT())});
    console.log(JSON.stringify(result,null,2));
  }else if(command==='verify'){
    console.log(JSON.stringify(assertWorkspaceIsolation({repoRoot:arg('repo-root',ROOT),workspace:arg('workspace'),entrySha:arg('entry-sha')}),null,2));
  }else if(command==='capture'){
    const result=captureAgentResult({repoRoot:arg('repo-root',ROOT),workspace:arg('workspace'),agentId:arg('agent'),taskId:arg('task'),entrySha:arg('entry-sha'),executionSha:arg('execution-sha'),mainSha:arg('main-sha'),summary:arg('summary'),status:arg('status','READY_FOR_CHAIR1')});
    const out=arg('output','/tmp/flixo-agent-result.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({resultId:result.resultId,output:out,changedFiles:result.changedFiles},null,2));
  }else if(command==='cleanup') console.log(JSON.stringify(cleanupAgentWorkspace({repoRoot:arg('repo-root',ROOT),workspace:arg('workspace'),force:arg('force')==='true'}),null,2));
  else throw new Error('Usage: agent-isolated-workspace.mjs snapshot|create|verify|capture|cleanup');
}
