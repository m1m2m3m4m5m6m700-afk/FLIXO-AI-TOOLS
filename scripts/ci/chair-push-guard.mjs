#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {repositoryMode, recordRejectedPushValidation} from './chair-bound-execution.mjs';

const ROOT=process.cwd();
const SHA_RE=/^[a-f0-9]{40}$/u;
const HASH_RE=/^[0-9a-f]{64}$/u;
const PATH_RE=/^(?!\/)(?!.*\.\.)[^\r\n]*$/u;
const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback;};
const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sha=String(arg('sha')||git(['rev-parse','HEAD'])).trim();
const proposalFile=arg('proposal');
const output=arg('output','/tmp/flixo-chair-push-guard.json');
const memoryOutput=arg('memory-output','');

const checks=[];
const failures=[];
function check(name,ok,code='VALIDATION_FAILED',details={}){
  const status=ok?'PASS':'FAIL';
  checks.push({name,status,code:ok?null:code,...details});
  if(!ok)failures.push(code);
  return ok;
}
function report(extra={}){
  const status=failures.length?'FAIL':'PASS';
  return {
    schemaVersion:2,
    protocol:'FLIXO-CHAIR-PUSH-VALIDATOR-v1',
    phase:'PROPOSAL_GUARD',
    authority:'VALIDATION_ONLY',
    decisionAuthority:'assistantController',
    proposalId:proposal?.proposalId??null,
    validationStatus:status,
    readyForController:status==='PASS',
    decision:null,
    failedChecks:[...new Set(failures)],
    checks,
    targetSha:proposal?.targetSha??sha,
    currentSha:sha,
    candidateSha:proposal?.candidateSha??null,
    parentSha:proposal?.parentSha??null,
    proposerChair:proposal?.proposerChair??null,
    workPackageId:proposal?.workPackageId??null,
    taskId:proposal?.taskId??null,
    controllerAction:status==='PASS'
      ?'ASSISTANT_CONTROLLER_MUST_DECIDE_ACCEPT_OR_REJECT'
      :'ASSISTANT_CONTROLLER_MUST_REVIEW_FAILURES_AND_DECIDE_NEXT_STEP',
    generatedAt:new Date().toISOString(),
    ...extra
  };
}
function persist(result){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  if(memoryOutput && result.validationStatus==='FAIL'){
    const memoryRecord={schemaVersion:2,protocol:'FLIXO-REJECTED-PUSH-MEMORY-v2',authority:'VALIDATION_ONLY',proposalId:result.proposalId??null,targetSha:result.targetSha??null,currentSha:result.currentSha??null,candidateSha:result.candidateSha??null,parentSha:result.parentSha??null,failedChecks:result.failedChecks??[],generatedAt:result.generatedAt};
    fs.mkdirSync(path.dirname(memoryOutput),{recursive:true});
    fs.appendFileSync(memoryOutput,JSON.stringify(memoryRecord)+'\n');
  }
  if(result.validationStatus==='FAIL' && proposal?.proposalId){
    recordRejectedPushValidation({
      proposalId:proposal.proposalId,
      currentSha:result.currentSha,
      reasonCode:'CHAIR_GUARD_VALIDATION_FAILED',
      validationEvidence:result
    });
  }
  console.log(JSON.stringify(result,null,2));
}

let proposal=null;
try{
  check('sha.format',SHA_RE.test(sha),'CHAIR_GUARD_SHA_INVALID');
  check('proposal.path',Boolean(proposalFile),'CHAIR_GUARD_PROPOSAL_REQUIRED');
  if(proposalFile){
    try{proposal=JSON.parse(fs.readFileSync(proposalFile,'utf8'));check('proposal.load',true);}
    catch(error){check('proposal.load',false,'CHAIR_GUARD_PROPOSAL_INVALID',{error:String(error?.message??error)});}
  }
  if(!proposal){persist(report());process.exitCode=0;process.exit(0);}
  check('proposal.protocol',proposal.protocol==='FLIXO-CHAIR-PUSH-PROPOSAL-v2','CHAIR_GUARD_PROTOCOL_INVALID');
  check('proposal.proposerChair',['chair_2','chair_3'].includes(proposal.proposerChair),'CHAIR_GUARD_PROPOSER_SEAT_INVALID');
  check('proposal.targetSha',SHA_RE.test(String(proposal.targetSha))&&proposal.targetSha===sha,'CHAIR_GUARD_STALE_PROPOSAL');
  check('proposal.parentSha',proposal.parentSha===sha,'CHAIR_GUARD_PARENT_NOT_CURRENT');
  check('proposal.candidateSha',SHA_RE.test(String(proposal.candidateSha))&&proposal.candidateSha!==sha,'CHAIR_GUARD_CANDIDATE_INVALID');
  for(const p of proposal.paths??[])check('proposal.path:'+String(p),PATH_RE.test(String(p)),'CHAIR_GUARD_PATH_INVALID',{path:p});

  const d=proposal.pushDetails;
  const required=['pushId','actorAgent','actorRole','sessionId','event','reason','changeType','repository','branch','commitMessage','commitTreeSha','requestedAt','expectedRemoteSha','candidateSha','parentSha'];
  check('pushManifest.object',Boolean(d&&typeof d==='object'&&!Array.isArray(d)),'CHAIR_GUARD_PUSH_DETAILS_REQUIRED');
  if(d&&typeof d==='object'&&!Array.isArray(d)){
    const missing=required.filter(f=>String(d[f]??'').trim()==='');
    check('pushManifest.fields',missing.length===0,'CHAIR_GUARD_PUSH_DETAILS_REQUIRED',{missingFields:missing});
    check('pushManifest.actor',String(d.actorAgent)===String(proposal.proposerAgent),'CHAIR_GUARD_PUSH_ACTOR_MISMATCH');
    check('pushManifest.event',String(d.event)==='PUSH','CHAIR_GUARD_PUSH_EVENT_INVALID');
    const expectedRepo=String(process.env.GITHUB_REPOSITORY??d.repository);
    check('pushManifest.repository',String(d.repository)===expectedRepo,'CHAIR_GUARD_PUSH_REPOSITORY_MISMATCH');
    check('pushManifest.branch',String(d.branch)==='execution','CHAIR_GUARD_PUSH_BRANCH_INVALID');
    check('pushManifest.expectedRemoteSha',String(d.expectedRemoteSha)===sha,'CHAIR_GUARD_PUSH_EXPECTED_REMOTE_SHA_MISMATCH');
    check('pushManifest.commitIdentity',String(d.candidateSha)===String(proposal.candidateSha)&&String(d.parentSha)===String(proposal.parentSha),'CHAIR_GUARD_PUSH_COMMIT_IDENTITY_MISMATCH');
    check('pushManifest.patchDigest',HASH_RE.test(String(proposal.patchSha256)),'CHAIR_GUARD_PATCH_DIGEST_REQUIRED');
    check('pushManifest.treeSha',HASH_RE.test(String(d.commitTreeSha)),'CHAIR_GUARD_COMMIT_TREE_REQUIRED');
    check('pushManifest.commitMessage',/^[\s\S]{1,4000}$/u.test(String(d.commitMessage)),'CHAIR_GUARD_COMMIT_MESSAGE_INVALID');
    check('pushManifest.reason',/^[^\r\n]{8,1000}$/u.test(String(d.reason)),'CHAIR_GUARD_REASON_REQUIRED');
    check('pushManifest.requestedAt',/^\d{4}-\d{2}-\d{2}T[^\r\n]+Z$/u.test(String(d.requestedAt)),'CHAIR_GUARD_REQUESTED_AT_INVALID');

    let remoteSha=String(process.env.FLIXO_GUARD_REMOTE_SHA??'').trim();
    if(!remoteSha){
      const repository=String(process.env.GITHUB_REPOSITORY??'').trim();
      if(repository){
        try{remoteSha=execFileSync('gh',['api',`repos/${repository}/git/ref/heads/execution`,'--jq','.object.sha'],{cwd:ROOT,encoding:'utf8'}).trim();}
        catch(error){check('remoteSha.available',false,'CHAIR_GUARD_REMOTE_SHA_UNAVAILABLE',{error:String(error?.message??error)});}
      }else check('remoteSha.available',false,'CHAIR_GUARD_REMOTE_SHA_UNAVAILABLE');
    }
    if(remoteSha)check('remoteSha.current',remoteSha===sha,'STALE_EXECUTION_SHA',{remoteSha});

    if(candidateOk()){
      try{
        const actualTree=git(['show','-s','--format=%T',proposal.candidateSha]);
        check('git.commitTree',actualTree===String(d.commitTreeSha),'CHAIR_GUARD_COMMIT_TREE_MISMATCH');
        const actualMessage=git(['show','-s','--format=%B',proposal.candidateSha]).replace(/\s+$/u,'');
        check('git.commitMessage',actualMessage===String(d.commitMessage).replace(/\s+$/u,''),'CHAIR_GUARD_COMMIT_MESSAGE_MISMATCH');
        const actualParent=git(['show','-s','--format=%P',proposal.candidateSha]).split(/\s+/u).filter(Boolean);
        check('git.commitParent',actualParent.includes(sha),'CHAIR_GUARD_COMMIT_PARENT_MISMATCH');
        const actualPaths=git(['diff','--name-only',proposal.parentSha,proposal.candidateSha]).split(/\r?\n/u).filter(Boolean).sort();
        const proposedPaths=[...(proposal.paths??[])].map(String).sort();
        check('git.changedPaths',JSON.stringify(actualPaths)===JSON.stringify(proposedPaths),'CHAIR_GUARD_CHANGED_PATHS_MISMATCH',{actualPaths,proposedPaths});
        const actualPatch=createHash('sha256').update(git(['diff','--binary',proposal.parentSha,proposal.candidateSha]),'utf8').digest('hex');
        check('git.patchDigest',actualPatch===String(proposal.patchSha256),'CHAIR_GUARD_PATCH_DIGEST_MISMATCH');
      }catch(error){
        check('git.validation',false,'CHAIR_GUARD_GIT_VALIDATION_ERROR',{error:String(error?.message??error)});
      }
    }
  }

  try{
    const chairState=repositoryMode({targetSha:sha});
    const chair1Active=chairState.activeChairs.some(c=>c.chairId==='chair_1');
    check('chair1.state',!chair1Active,'CHAIR1_ACTIVE_CONDITION',{activeChairs:chairState.activeChairs});
  }catch(error){
    check('chair1.state',false,'CHAIR_GUARD_CHAIR_STATE_UNAVAILABLE',{error:String(error?.message??error)});
  }
}catch(error){
  check('validator.runtime',false,'CHAIR_GUARD_VALIDATOR_RUNTIME_ERROR',{error:String(error?.message??error)});
}
persist(report());

function candidateOk(){
  try{return Boolean(proposal?.candidateSha)&&git(['cat-file','-e',proposal.candidateSha+'^{commit}'])!=='';}
  catch{return false;}
}
