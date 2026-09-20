#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const run=(args,{allowFailure=false}={})=>{
  try{return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe',allowFailure?'pipe':'inherit']}).trim();}
  catch(error){
    if(allowFailure) return '';
    throw error;
  }
};
const branch=run(['branch','--show-current']);
if(branch!=='execution') throw new Error('BRANCH_CONFLICT_RECOVERY_REQUIRES_EXECUTION');

const localSha=run(['rev-parse','HEAD']);
run(['fetch','--no-tags','origin','execution']);
const remoteSha=run(['rev-parse','origin/execution']);

if(localSha===remoteSha){
  console.log(JSON.stringify({status:'NO_CONFLICT',localSha,remoteSha,recovered:false},null,2));
  process.exit(0);
}

const patch=run(['diff','--binary','HEAD']);
if(!patch){
  run(['reset','--hard',remoteSha]);
  console.log(JSON.stringify({
    status:'RECOVERED_HEAD_ONLY',
    previousSha:localSha,
    currentSha:remoteSha,
    patchReapplied:false,
    reason:'REMOTE_HEAD_MOVED_WITHOUT_LOCAL_REPAIR_DIFF'
  },null,2));
  process.exit(0);
}

const patchFile='/tmp/flixo-branch-conflict-repair.patch';
const fs=(await import('node:fs')).default;
fs.writeFileSync(patchFile,patch+'\n');

run(['reset','--hard',remoteSha]);
let applied=true;
try{
  execFileSync('git',['apply','--3way','--whitespace=nowarn',patchFile],{stdio:'inherit'});
}catch{
  applied=false;
}
const unresolved=run(['diff','--name-only','--diff-filter=U'],{allowFailure:true});
if(!applied || unresolved){
  run(['reset','--hard',remoteSha]);
  console.log(JSON.stringify({
    status:'REPAIR_REGENERATE_REQUIRED',
    previousSha:localSha,
    currentSha:remoteSha,
    patchReapplied:false,
    unresolved:unresolved?unresolved.split(/\r?\n/).filter(Boolean):[],
    action:'KEEP_SAME_MISSION_REGENERATE_REPAIR_ON_CURRENT_SHA'
  },null,2));
  process.exit(2);
}

console.log(JSON.stringify({
  status:'RECOVERED',
  previousSha:localSha,
  currentSha:remoteSha,
  patchReapplied:true,
  action:'REVERIFY_ON_CURRENT_SHA'
},null,2));
