#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const OUT=path.resolve(ROOT,'diagnostics/auto-repair/action-vault/historical-predictions/latest.json');
const normalize=(value)=>String(value??'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu,'').replace(/\b[a-f0-9]{40}\b/giu,'<SHA>').replace(/\b\d{8,}\b/gu,'<N>').replace(/\s+/gu,' ').trim().toLowerCase();
const tokens=(value)=>[...new Set((normalize(value).match(/[a-z][a-z0-9_-]{2,}/g)||[]).filter(x=>!['the','and','run','with','from','this','that','error','failed','failure'].includes(x)))];
const readJson=(file,fallback)=>{try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback}catch{return fallback}};
const exact=(v)=>/^[a-f0-9]{40}$/u.test(String(v));
const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback};
const sha256=(v)=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const readRecords=(dir)=>{
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(x=>readJson(path.join(dir,x),null)).filter(Boolean);
};

export function buildPrediction({
  taskId,fingerprint,targetSha,failedRunId,failureLog='',workflow='',job=''
}={}){
  if(!taskId||!fingerprint||!exact(targetSha)||!failedRunId)throw new Error('ACTION_HISTORICAL_PREDICTOR_IDENTITY_REQUIRED');
  const index=readJson(path.join(ROOT,'docs/agents/historical-action-errors/index.json'),{byFingerprint:{},byNormalized:{},byClass:{},byWorkflow:{},recordCount:0});
  const recordsDir=path.join(ROOT,'docs/agents/historical-action-errors/records');
  const memory=readJson(path.join(ROOT,'diagnostics/auto-repair/memory.json'),{cases:[]});
  const actionIndexRaw=readJson(path.join(ROOT,'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json'),{records:[],entries:[]});
  const currentTokens=tokens([failureLog,workflow,job].join(' '));
  const exactIds=index.byFingerprint?.[fingerprint]??[];
  const exactRecords=exactIds.map(id=>readJson(path.join(recordsDir,id+'.json'),null)).filter(Boolean);
  const workflowIds=index.byWorkflow?.[workflow]??[];
  const workflowRecords=workflowIds.map(id=>readJson(path.join(recordsDir,id+'.json'),null)).filter(Boolean);

  const corpus=[...readRecords(recordsDir)];
  const candidates=[...corpus,...(Array.isArray(actionIndexRaw?.records)?actionIndexRaw.records:[]),...(Array.isArray(actionIndexRaw?.entries)?actionIndexRaw.entries:[]),...(memory.cases??[])];

  const scored=candidates.map((record)=>{
    const text=JSON.stringify(record);
    const rt=tokens(text);
    const overlap=currentTokens.filter(t=>rt.includes(t)).length;
    const rootCause=String(record.rootCause??'').toLowerCase();
    const workflowMatch=workflow && String(record.workflow??'')===workflow;
    const classMatch=record.errorClass && currentTokens.includes(String(record.errorClass).toLowerCase());
    const outcomeSuccess=(Number(record.successes??0)>0)||((record.outcomes??[]).some(o=>String(o.outcome).toLowerCase()==='success'||String(o.verification).toLowerCase()==='success'));
    let score=Math.min(1,overlap/Math.max(4,currentTokens.length)*0.6);
    if(rootCause)score+=0.05;
    if(workflowMatch)score+=0.18;
    if(classMatch)score+=0.08;
    if(outcomeSuccess)score+=0.09;
    if(exactIds.includes(record.id))score+=0.45;
    return {record,score:Math.min(1,score),overlap,workflowMatch,outcomeSuccess};
  }).sort((a,b)=>b.score-a.score).slice(0,20);

  const similarCases=scored.map((item)=>({
    id:item.record.id??item.record.fingerprint??null,
    score:Number(item.score.toFixed(4)),
    overlap:item.overlap,
    workflowMatch:item.workflowMatch,
    outcomeSuccess:item.outcomeSuccess,
    errorClass:item.record.errorClass??null,
    rootCause:item.record.rootCause??null,
    normalized:item.record.normalized??item.record.normalizedFailure??null,
    failedShas:item.record.shas??item.record.provenance?.failedSha?[item.record.provenance.failedSha]:[],
    strategies:[...(item.record.rules??[]),...(item.record.successfulStrategies??[]),...(item.record.action?[item.record.action]:[]),...(item.record.teaching?[item.record.teaching]:[])],
    historicalAction:item.record.action??null,
    historicalTeaching:item.record.teaching??null,
    verificationRule:item.record.verify??null,
    changedPaths:item.record.changedPaths??item.record.solution?.changedPaths??[]
  }));

  const strategyCounts=new Map();
  for(const item of similarCases)for(const rule of item.strategies??[]) {
    const key=typeof rule==='string'?rule:JSON.stringify(rule);
    strategyCounts.set(key,(strategyCounts.get(key)||0)+1);
  }
  const candidateStrategies=[...strategyCounts.entries()].map(([strategy,count])=>({strategy,count,confidence:Number(Math.min(0.95,0.35+count*0.1).toFixed(3))})).sort((a,b)=>b.confidence-a.confidence).slice(0,15);
  const predictedActions=similarCases.filter(x=>x.historicalAction).slice(0,10).map(x=>({id:x.id,action:x.historicalAction,teaching:x.historicalTeaching,verify:x.verificationRule,score:x.score}));
  const predictedFiles=[...new Set(similarCases.flatMap(x=>x.changedPaths??[]).filter(Boolean))].slice(0,30);
  const predictedChecks=[...new Set([
    'node scripts/ci/action-vault-agent-gate.mjs',
    ...predictedFiles.filter(p=>/^\.github\/workflows\//u.test(p)).map(()=> 'node scripts/validate-ci-contract.mjs'),
    ...predictedFiles.filter(p=>/\.(?:ts|tsx|mjs|js)$/u.test(p)).map(()=> 'npm run typecheck'),
    ...predictedFiles.filter(p=>p.includes('action-vault')).map(()=> 'npm run test:action-code-mentor')
  ])];

  const confidence=Number(Math.min(0.98,
    (similarCases[0]?.score??0)*0.55+
    (candidateStrategies[0]?.confidence??0)*0.25+
    (exactRecords.length?0.15:0)+
    (workflowRecords.length?0.05:0)
  ).toFixed(3));

  return {
    schemaVersion:1,
    protocol:'PREDICTIVE_REPAIR_PACKET_V1',
    status:'PROVISIONAL',
    identity:{taskId,fingerprint,targetSha,failedRunId},
    search:{
      historicalIndex:true,
      actionIndex4000:true,
      repairMemory:true,
      exactFingerprintMatches:exactRecords.length,
      workflowMatches:workflowRecords.length,
      corpusSize:corpus.length,
      actionIndexSize:Array.isArray(actionIndexRaw?.records)?actionIndexRaw.records.length:Array.isArray(actionIndexRaw?.entries)?actionIndexRaw.entries.length:0
    },
    similarCases,
    candidateStrategies,
    proposedRepair:{
      mode:'OWNER_REVIEW_REQUIRED',
      predictedFiles,
      predictedChecks,
      candidateStrategy:candidateStrategies[0]?.strategy??predictedActions[0]?.action??null,
      historicalActions:predictedActions,
      confidence,
      notCertain:true
    },
    unknowns:[
      'Historical similarity does not prove the current root cause.',
      'A historical strategy may be stale or reverted.',
      'Current exact-SHA reproduction and regression are mandatory.'
    ],
    whyNotCertain:'This packet ranks historical evidence; it does not certify correctness or authorize mutation.',
    nextAction:'ACTION-REPAIR_REVIEWS_AND_REPRODUCES_PREDICTION',
    generatedAt:new Date().toISOString(),
    packetDigest:sha256(taskId+'|'+fingerprint+'|'+targetSha+'|'+JSON.stringify(similarCases.slice(0,5)))
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
 const packet=buildPrediction({
  taskId:arg('task'),
  fingerprint:arg('fingerprint'),
  targetSha:arg('sha'),
  failedRunId:arg('run-id'),
  failureLog:arg('failure-log'),
  workflow:arg('workflow'),
  job:arg('job')
 });
 fs.mkdirSync(path.dirname(OUT),{recursive:true});
 fs.writeFileSync(OUT,JSON.stringify(packet,null,2)+'\n');
 console.log(JSON.stringify({
  status:'PASS',
  protocol:packet.protocol,
  confidence:packet.proposedRepair.confidence,
  similarCases:packet.similarCases.length,
  candidateStrategies:packet.candidateStrategies.length,
  predictedFiles:packet.proposedRepair.predictedFiles.length,
  output:OUT
 },null,2));
}
