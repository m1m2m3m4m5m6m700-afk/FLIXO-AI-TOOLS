#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {recordGuardDecision,repositoryMode} from './chair-bound-execution.mjs';

const ROOT=process.cwd();
const SHA_RE=/^[a-f0-9]{40}$/u;
const PATH_RE=/^(?!\/)(?!.*\.\.)[^\r\n]*$/u;
const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback;};
const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sha=String(arg('sha')||git(['rev-parse','HEAD'])).trim();
const readJson=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const proposalFile=arg('proposal');
const output=arg('output','/tmp/flixo-chair-push-guard.json');
const memoryOutput=arg('memory-output','.flixo/locks/rejected-push-memory.jsonl');
if(!SHA_RE.test(sha))throw new Error('CHAIR_GUARD_SHA_INVALID');
if(!proposalFile)throw new Error('CHAIR_GUARD_PROPOSAL_REQUIRED');
const proposal=readJson(proposalFile);
if(proposal.protocol!=='FLIXO-CHAIR-PUSH-PROPOSAL-v2')throw new Error('CHAIR_GUARD_PROTOCOL_INVALID');
if(!['chair_2','chair_3'].includes(proposal.proposerChair))throw new Error('CHAIR_GUARD_PROPOSER_SEAT_INVALID');
if(!SHA_RE.test(String(proposal.targetSha))||proposal.targetSha!==sha)throw new Error('CHAIR_GUARD_STALE_PROPOSAL');
if(proposal.parentSha!==sha)throw new Error('CHAIR_GUARD_PARENT_NOT_CURRENT');
if(!SHA_RE.test(String(proposal.candidateSha))||proposal.candidateSha===sha)throw new Error('CHAIR_GUARD_CANDIDATE_INVALID');
for(const p of proposal.paths??[])if(!PATH_RE.test(String(p)))throw new Error('CHAIR_GUARD_PATH_INVALID');
const details=proposal.pushDetails;
if(!details || typeof details!=='object' || Array.isArray(details))throw new Error('CHAIR_GUARD_PUSH_DETAILS_REQUIRED');
const requiredPushFields=['pushId','actorAgent','actorRole','sessionId','event','reason','changeType','repository','branch','commitMessage','commitTreeSha','requestedAt','expectedRemoteSha','candidateSha','parentSha'];
const missingPushFields=requiredPushFields.filter((field)=>String(details[field]??'').trim()==='');
if(missingPushFields.length)throw new Error('CHAIR_GUARD_PUSH_DETAILS_REQUIRED='+missingPushFields.join(','));
if(String(details.actorAgent)!==String(proposal.proposerAgent))throw new Error('CHAIR_GUARD_PUSH_ACTOR_MISMATCH');
if(String(details.event)!=='PUSH')throw new Error('CHAIR_GUARD_PUSH_EVENT_INVALID');
if(String(details.repository)!==String(process.env.GITHUB_REPOSITORY??details.repository))throw new Error('CHAIR_GUARD_PUSH_REPOSITORY_MISMATCH');
if(String(details.branch)!=='execution')throw new Error('CHAIR_GUARD_PUSH_BRANCH_INVALID');
if(String(details.expectedRemoteSha)!==String(sha))throw new Error('CHAIR_GUARD_PUSH_EXPECTED_REMOTE_SHA_MISMATCH');
if(String(details.candidateSha)!==String(proposal.candidateSha)||String(details.parentSha)!==String(proposal.parentSha))throw new Error('CHAIR_GUARD_PUSH_COMMIT_IDENTITY_MISMATCH');
if(!/^[0-9a-f]{64}$/u.test(String(proposal.patchSha256)))throw new Error('CHAIR_GUARD_PATCH_DIGEST_REQUIRED');
if(!/^[0-9a-f]{64}$/u.test(String(details.commitTreeSha)))throw new Error('CHAIR_GUARD_COMMIT_TREE_REQUIRED');
if(!/^[\s\S]{1,4000}$/u.test(String(details.commitMessage)))throw new Error('CHAIR_GUARD_COMMIT_MESSAGE_INVALID');
if(!/^[^\r\n]{8,1000}$/u.test(String(details.reason)))throw new Error('CHAIR_GUARD_REASON_REQUIRED');
if(!/^\d{4}-\d{2}-\d{2}T[^\r\n]+Z$/u.test(String(details.requestedAt)))throw new Error('CHAIR_GUARD_REQUESTED_AT_INVALID');


let remoteSha=String(process.env.FLIXO_GUARD_REMOTE_SHA??'').trim();
if(!remoteSha){
  const repo=String(process.env.GITHUB_REPOSITORY??'').trim();
  if(repo) { try { remoteSha=execFileSync('gh',['api',`repos/${repo}/git/ref/heads/execution`,'--jq','.object.sha'],{cwd:ROOT,encoding:'utf8'}).trim(); } catch { remoteSha=sha; } }
  else remoteSha=sha;
}
function persistResult(result){ fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); }
function persistMemory(memory){ fs.mkdirSync(path.dirname(memoryOutput),{recursive:true}); if(memory) fs.appendFileSync(memoryOutput,JSON.stringify(memory)+'\n'); }
const mode=repositoryMode({targetSha:sha});
if(mode.activeChairs.some((chair)=>chair.chairId==='chair_1')){
  const result={schemaVersion:1,protocol:'FLIXO-CHAIR-PUSH-GUARD-v2',proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'CHAIR1_ACTIVE_CONFLICT',targetSha:proposal.targetSha,currentSha:sha,proposerChair:proposal.proposerChair,reusable:true,reuseCondition:'WAIT_FOR_CHAIR_1_RELEASE_THEN_REVALIDATE_EXACT_SHA',generatedAt:new Date().toISOString()};
  persistResult(result);
  const mem=recordGuardDecision({proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'CHAIR1_ACTIVE_CONFLICT',currentSha:sha,guardEvidence:{activeChairs:mode.activeChairs}});
  persistMemory(mem.rejectedPushMemory);
  console.log(JSON.stringify(result,null,2)); process.exit(0);
}

const actualTree=git(['show','-s','--format=%T',proposal.candidateSha]);
if(actualTree!==String(details.commitTreeSha))throw new Error('CHAIR_GUARD_COMMIT_TREE_MISMATCH');
const actualMessage=git(['show','-s','--format=%B',proposal.candidateSha]).replace(/\s+$/u,'');
if(actualMessage!==String(details.commitMessage).replace(/\s+$/u,''))throw new Error('CHAIR_GUARD_COMMIT_MESSAGE_MISMATCH');
const actualParent=git(['show','-s','--format=%P',proposal.candidateSha]).split(/\s+/u).filter(Boolean);
if(!actualParent.includes(sha))throw new Error('CHAIR_GUARD_COMMIT_PARENT_MISMATCH');
const actualPaths=git(['diff','--name-only',proposal.parentSha,proposal.candidateSha]).split(/\r?\n/u).filter(Boolean).sort();
const proposedPaths=[...(proposal.paths??[])].map(String).sort();
if(JSON.stringify(actualPaths)!==JSON.stringify(proposedPaths))throw new Error('CHAIR_GUARD_CHANGED_PATHS_MISMATCH');
const actualPatch=createHash('sha256').update(git(['diff','--binary',proposal.parentSha,proposal.candidateSha]),'utf8').digest('hex');
if(actualPatch!==String(proposal.patchSha256))throw new Error('CHAIR_GUARD_PATCH_DIGEST_MISMATCH');

if(remoteSha!==sha){
  const result={schemaVersion:1,protocol:'FLIXO-CHAIR-PUSH-GUARD-v2',proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'STALE_EXECUTION_SHA',targetSha:proposal.targetSha,currentSha:remoteSha,proposerChair:proposal.proposerChair,reusable:false,generatedAt:new Date().toISOString()};
  persistResult(result);
  const mem=recordGuardDecision({proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'STALE_EXECUTION_SHA',currentSha:sha,guardEvidence:{remoteSha}});
  persistMemory(mem.rejectedPushMemory);
  console.log(JSON.stringify(result,null,2)); process.exit(0);
}

let candidateExists=false; try { candidateExists=git(['cat-file','-e',`${proposal.candidateSha}^{commit}`])!==''; } catch { /* candidate unavailable; keep false */ }
if(!candidateExists){
  const result={schemaVersion:1,protocol:'FLIXO-CHAIR-PUSH-GUARD-v2',proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'CANDIDATE_NOT_AVAILABLE_TO_GUARD',targetSha:proposal.targetSha,currentSha:sha,proposerChair:proposal.proposerChair,reusable:true,reuseCondition:'RESTORE_CANDIDATE_OBJECT_AND_REVALIDATE_EXACT_SHA',generatedAt:new Date().toISOString()};
  persistResult(result);
  const mem=recordGuardDecision({proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'CANDIDATE_NOT_AVAILABLE_TO_GUARD',currentSha:sha,guardEvidence:{candidateSha:proposal.candidateSha}});
  persistMemory(mem.rejectedPushMemory);
  console.log(JSON.stringify(result,null,2)); process.exit(0);
}

const parents=git(['rev-list','--parents','-n','1',proposal.candidateSha]).split(/\s+/u).slice(1);
if(!parents.includes(sha)){
  const result={schemaVersion:1,protocol:'FLIXO-CHAIR-PUSH-GUARD-v2',proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'CANDIDATE_PARENT_CONFLICT',targetSha:proposal.targetSha,currentSha:sha,proposerChair:proposal.proposerChair,reusable:true,reuseCondition:'REBASE_OR_RECREATE_CANDIDATE_FROM_CURRENT_EXECUTION_SHA',generatedAt:new Date().toISOString()};
  persistResult(result);
  const mem=recordGuardDecision({proposalId:proposal.proposalId,decision:'REJECTED',reasonCode:'CANDIDATE_PARENT_CONFLICT',currentSha:sha,guardEvidence:{parents}});
  persistMemory(mem.rejectedPushMemory);
  console.log(JSON.stringify(result,null,2)); process.exit(0);
}

const result={schemaVersion:1,protocol:'FLIXO-CHAIR-PUSH-GUARD-v2',proposalId:proposal.proposalId,decision:'READY_FOR_CHAIR_1',reasonCode:'CURRENT_SHA_COMPATIBLE',targetSha:proposal.targetSha,currentSha:sha,candidateSha:proposal.candidateSha,parentSha:proposal.parentSha,proposerChair:proposal.proposerChair,paths:proposal.paths,workPackageId:proposal.workPackageId,taskId:proposal.taskId,reusable:true,nextAuthority:'CHAIR_1',generatedAt:new Date().toISOString()};
persistResult(result);
recordGuardDecision({proposalId:proposal.proposalId,decision:'READY_FOR_CHAIR_1',reasonCode:'CURRENT_SHA_COMPATIBLE',currentSha:sha,guardEvidence:{candidateExists,parents}});
console.log(JSON.stringify(result,null,2));
