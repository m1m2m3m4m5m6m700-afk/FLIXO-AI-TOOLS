#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';

const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(x=>x.startsWith(p));return hit?hit.slice(p.length):fallback;};
const prePath=arg('pre-proof','');
const out=arg('output','/tmp/action-vault-post-mutation-recheck.json');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const runId=arg('run-id','');
if(!prePath||!fs.existsSync(prePath)||!/^[a-f0-9]{40}$/u.test(targetSha)||!fingerprint||!runId)throw new Error('POST_MUTATION_RECHECK_IDENTITY_REQUIRED');
const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const currentSha=git(['rev-parse','HEAD']);
const branch=git(['branch','--show-current']);
const pre=JSON.parse(fs.readFileSync(prePath,'utf8'));
const diff=git(['diff','--binary']);
const changedFiles=git(['diff','--name-only',targetSha]).split(/\r?\n/u).filter(Boolean);
const patchDigest=crypto.createHash('sha256').update(diff).digest('hex');
const expectedDigest=pre.patchCorrectness?.patchDigest??pre.sandboxSimulation?.patchDigest??null;
const failures=[];
if(currentSha!==targetSha)failures.push('POST_MUTATION_HEAD_DRIFT');
if(branch!=='execution')failures.push('POST_MUTATION_BRANCH_INVALID');
if(pre.targetSha!==targetSha||pre.failureFingerprint!==fingerprint||pre.noMutationApplied!==true)failures.push('PRE_MUTATION_PROOF_IDENTITY_INVALID');
if(!diff||!changedFiles.length)failures.push('POST_MUTATION_SOURCE_DIFF_MISSING');
if(expectedDigest&&expectedDigest!==patchDigest)failures.push('PATCH_DIGEST_CHANGED_AFTER_SIMULATION');
if(pre.status!=='PROVEN')failures.push('PRE_MUTATION_PROOF_NOT_PROVEN');
try{git(['diff','--check']);}catch{failures.push('POST_MUTATION_DIFF_CHECK_FAILED');}

const checks=[
  ['typecheck','npm run typecheck'],
  ['static','npm run test:static'],
  ['build','npm run test:build'],
];
const receipts=[];
for(const [name,command] of checks){
  const result=spawnSync('npm',['run',command.slice('npm run '.length)],{encoding:'utf8',env:process.env,stdio:'pipe'});
  receipts.push({name,command,exitCode:Number(result.status??1),status:result.status===0?'PASS':'FAIL',stdoutDigest:crypto.createHash('sha256').update(result.stdout??'').digest('hex'),stderrDigest:crypto.createHash('sha256').update(result.stderr??'').digest('hex'),timestamp:new Date().toISOString()});
  if(result.status!==0)failures.push('POST_MUTATION_CHECK_FAILED='+name);
}
const status=failures.length===0?'PASS':'BLOCK';
const report={
 schemaVersion:1,protocol:'ACTION-VAULT-POST-MUTATION-RECHECK-v1',
 targetSha,failureFingerprint:fingerprint,runId,currentSha,branch,
 preMutationProofStatus:'STALE_AFTER_MUTATION',
 preMutationProofDigest:expectedDigest,actualPatchDigest:patchDigest,
 changedFiles,receipts,failures,status,verified:status==='PASS',
 noProofReuse:true,requiresCanonicalGreen:true,generatedAt:new Date().toISOString()
};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status,failures,changedFiles,actualPatchDigest:patchDigest,checks:receipts.map(x=>({name:x.name,status:x.status}))},null,2));
if(status!=='PASS')process.exitCode=1;
