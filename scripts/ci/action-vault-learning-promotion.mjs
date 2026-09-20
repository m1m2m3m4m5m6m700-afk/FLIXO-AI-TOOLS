#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const shaOk=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));

export function promoteVerifiedLearning({
 taskId,
 fingerprint,
 targetSha,
 executionSha,
 proofIds=[],
 greenRecord,
 lesson,
}={}){
  if(!taskId||!fingerprint||!shaOk(targetSha)||!shaOk(executionSha)) throw new Error('LEARNING_PROMOTION_IDENTITY_REQUIRED');
  if(!Array.isArray(proofIds)||proofIds.length<1) throw new Error('LEARNING_PROOF_IDS_REQUIRED');
  if(!greenRecord||greenRecord.source!=='DAILY_FLIXO_GREEN_GATE'||greenRecord.conclusion!=='success'||greenRecord.zeroRed!==true||greenRecord.exactShaVerified!==true) throw new Error('LEARNING_CANONICAL_GREEN_REQUIRED');
  if(greenRecord.targetSha!==executionSha||greenRecord.targetSha!==targetSha) throw new Error('LEARNING_GREEN_SHA_MISMATCH');
  if(greenRecord.taskId&&greenRecord.taskId!==taskId) throw new Error('LEARNING_GREEN_TASK_MISMATCH');
  if(greenRecord.fingerprint&&greenRecord.fingerprint!==fingerprint) throw new Error('LEARNING_GREEN_FINGERPRINT_MISMATCH');
  if(!greenRecord.recordId) throw new Error('LEARNING_GREEN_RECORD_ID_REQUIRED');
  const verified=Object.freeze({
    status:'VERIFIED',
    taskId,
    fingerprint,
    targetSha,
    executionSha,
    proofIds:[...new Set(proofIds.map(String).filter(Boolean))],
    greenRecordId:greenRecord.recordId,
    lesson:lesson??null,
    verifiedAt:new Date().toISOString(),
    verificationAuthority:'DAILY_FLIXO_GREEN_GATE',
    digest:crypto.createHash('sha256').update(JSON.stringify({taskId,fingerprint,targetSha,executionSha,proofIds,greenRecordId:greenRecord.recordId,lesson})).digest('hex'),
  });
  return verified;
}

if(process.argv[1]?.endsWith('action-vault-learning-promotion.mjs')){
  const input=read(process.argv[2]);
  const green=read(process.argv[3]);
  const proofIds=String(process.argv[4]??'').split(',').map(x=>x.trim()).filter(Boolean);
  const out=process.argv[5]??'/tmp/verified-learning.json';
  const result=promoteVerifiedLearning({...input,greenRecord:green,proofIds});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
