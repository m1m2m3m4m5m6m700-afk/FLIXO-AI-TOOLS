#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const run=(args,{allowFailure=false}={})=>{
  try{return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe',allowFailure?'pipe':'inherit']}).trim();}
  catch(error){
    if(allowFailure)return '';
    throw error;
  }
};

if(run(['branch','--show-current'])!=='execution') throw new Error('BRANCH_CONFLICT_RECOVERY_REQUIRES_EXECUTION');

const localSha=run(['rev-parse','HEAD']);
run(['fetch','--no-tags','origin','execution']);
const remoteSha=run(['rev-parse','origin/execution']);

if(localSha===remoteSha){
  console.log(JSON.stringify({status:'NO_CONFLICT',localSha,remoteSha,recovered:false},null,2));
  process.exit(0);
}

// Never transplant an old repair blindly onto a changed execution head.
// Rebind the same mission to the authoritative current SHA and let the
// existing RCA/strategy/dual-control/repair pipeline regenerate the repair.
run(['reset','--hard',remoteSha]);

console.log(JSON.stringify({
  status:'REQUALIFY_REQUIRED',
  previousSha:localSha,
  currentSha:remoteSha,
  oldRepairContextDiscarded:true,
  sameMissionContinuation:true,
  action:'REQUALIFY_CURRENT_HEAD_THEN_REPAIR_AND_REVERIFY'
},null,2));
