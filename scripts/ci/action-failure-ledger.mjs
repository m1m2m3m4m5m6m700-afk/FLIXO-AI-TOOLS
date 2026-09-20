#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const LEDGER=path.resolve(ROOT,'diagnostics/auto-repair/action-vault/failure-ledger.ndjson');
const validSha=(v)=>/^[a-f0-9]{40}$/u.test(String(v));
const sha256=(v)=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback};

export function appendFailureLedger(event){
 if(!event?.taskId||!event?.failureFingerprint||!validSha(event.targetSha)||!event?.failedRunId)throw new Error('ACTION_FAILURE_LEDGER_IDENTITY_REQUIRED');
 const record={
  schemaVersion:1,
  protocol:'ACTION_FAILURE_LEDGER_V1',
  eventId:'AFL-'+sha256([event.taskId,event.failureFingerprint,event.targetSha,event.failedRunId,event.eventType,event.at].join('|')).slice(0,24),
  eventType:event.eventType??'FAILURE',
  taskId:event.taskId,
  failureFingerprint:event.failureFingerprint,
  targetSha:event.targetSha,
  failedRunId:String(event.failedRunId),
  botId:event.botId??'ACTION-HISTORIAN-3',
  workflow:event.workflow??null,
  job:event.job??null,
  rootCause:event.rootCause??null,
  attemptedStrategy:event.attemptedStrategy??null,
  result:event.result??'UNVERIFIED',
  evidence:event.evidence??[],
  notes:event.notes??null,
  at:event.at??new Date().toISOString()
 };
 fs.mkdirSync(path.dirname(LEDGER),{recursive:true});
 fs.appendFileSync(LEDGER,JSON.stringify(record)+'\n');
 return record;
}

export function recordRed(data){return appendFailureLedger({...data,eventType:'RED_DETECTED',result:'OPEN'})}
export function recordAttempt(data){return appendFailureLedger({...data,eventType:'REPAIR_ATTEMPT',result:data.result??'ATTEMPTED'})}
export function recordFailedAttempt(data){return appendFailureLedger({...data,eventType:'REPAIR_FAILED',result:'FAILED'})}
export function recordHandoff(data){return appendFailureLedger({...data,eventType:'HANDOFF',result:'HANDED_OFF'})}
export function recordPredictionGenerated(data){return appendFailureLedger({...data,eventType:'PREDICTION_GENERATED',result:'PROVISIONAL'})}
export function recordPredictionOutcome(data){return appendFailureLedger({...data,eventType:data.accepted?'PREDICTION_ACCEPTED':'PREDICTION_REJECTED',result:data.accepted?'ACCEPTED':'REJECTED'})}
export function recordGreen(data){return appendFailureLedger({...data,eventType:'GREEN_VERIFIED',result:'VERIFIED'})}

if(import.meta.url===`file://${process.argv[1]}`){
 const eventType=arg('event','FAILURE');
 const data={
  taskId:arg('task'),
  failureFingerprint:arg('fingerprint'),
  targetSha:arg('sha'),
  failedRunId:arg('run-id'),
  botId:arg('bot','ACTION-HISTORIAN-3'),
  workflow:arg('workflow'),
  job:arg('job'),
  notes:arg('notes'),
 };
 const event=appendFailureLedger({...data,eventType,result:arg('result','UNVERIFIED')});
 console.log(JSON.stringify({status:'PASS',eventId:event.eventId,eventType:event.eventType,ledger:LEDGER},null,2));
}
