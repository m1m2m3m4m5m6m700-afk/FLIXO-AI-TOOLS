#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { query as queryHistoricalActionErrors } from './historical-action-error-index.mjs';

const ROOT=process.cwd();
const REGISTRY=path.join(ROOT,'docs/agents/CELL-BOT-REGISTRY.json');
const SHARED_REFS=[
  'docs/agents/historical-action-errors/index.json',
  'docs/agents/historical-action-errors/records',
  'docs/AUTO_REPAIR_HISTORY.jsonl',
  'diagnostics/auto-repair/memory.json',
  'docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json',
  'docs/agents/ERROR-TEACHING-ROUTER.json',
  'docs/agents/INFERENTIAL-REPAIR-INTELLIGENCE.md'
];
const ROLE_MAP=Object.freeze({
  'CELL-001':'ACTION_SOLUTION_INDEXER',
  'CELL-002':'ACTION_SYSTEM_WAKE_COORDINATOR',
  'CELL-003':'ACTION_REPAIR_TWIN_A',
  'CELL-004':'ACTION_REPAIR_TWIN_B',
  'CELL-005':'ACTION_BEST_OPTION_SELECTOR'
});
const sha=v=>/^[a-f0-9]{40}$/iu.test(String(v??''));
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):String(fallback)};
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const targetSha=arg('target-sha',process.env.FLIXO_EXPECTED_TARGET_SHA);
const runId=arg('run-id',process.env.TARGET_RUN_ID);
const fingerprint=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT);
const logPath=arg('log',process.env.FLIXO_FAILURE_LOG||'');
const role=arg('role','fanout');
const out=arg('output',process.env.FLIXO_FIVE_ACTION_REPAIR_OUTPUT||'/tmp/flixo-five-action-repair-workers.json');
const normalize=s=>String(s??'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-?]*[ -/]*[@-~]','gu'),'').replace(/\\s+/gu,' ').trim();
const digest=s=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const requireIdentity=()=>{if(!sha(targetSha))throw new Error('FIVE_ACTION_REPAIR_TARGET_SHA_INVALID');if(!runId)throw new Error('FIVE_ACTION_REPAIR_RUN_ID_REQUIRED');if(!fingerprint)throw new Error('FIVE_ACTION_REPAIR_FINGERPRINT_REQUIRED')};
const registry=readJson(REGISTRY);
const cohort=registry.actionRepairCohort;
const workerIds=cohort.workerIds;
if(!Array.isArray(workerIds)||workerIds.length!==5||new Set(workerIds).size!==5)throw new Error('FIVE_ACTION_REPAIR_COHORT_INVALID');
const missing=SHARED_REFS.filter(ref=>!fs.existsSync(path.join(ROOT,ref)));
if(missing.length)throw new Error('FIVE_ACTION_REPAIR_SHARED_REFERENCE_MISSING='+missing.join(','));
const rawLog=logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';
const normalized=normalize(rawLog);
const logDigest=digest(normalized);
const topTerms=[...new Set(normalized.match(/[A-Za-z][A-Za-z0-9_-]{3,}/gu)?.slice(0,24)??[])];
function historicalSolutions(limit=8){
 const found=[];
 for(const term of topTerms){
   for(const record of queryHistoricalActionErrors({term,limit:4})){found.push(record)}
 }
 const seen=new Set();
 return found.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true}).slice(0,limit);
}
function optionStrategy(option){
 return String(option?.challenge?.preferredAlternativeStrategy || option?.independentDiagnosis?.repairHypothesis?.strategyId || option?.strategyId || '').trim();
}
function scoreOption(option, historicalCount){
 const confidence=Number(option?.independentDiagnosis?.causalConfidence ?? option?.challenge?.inferredFallback?.confidence ?? option?.confidence ?? 0);
 const exact=option?.targetSha===targetSha;
 const falsify=(Array.isArray(option?.independentDiagnosis?.falsificationChecks)&&option.independentDiagnosis.falsificationChecks.length>0) || Boolean(option?.challenge?.inferredFallback?.falsification);
 const safe=option?.mutationAuthority===false && option?.repositoryWrite===false && option?.actionsWrite===false;
 const strategy=optionStrategy(option);
 return (exact?4:0)+(safe?2:0)+(falsify?2:0)+Math.min(2,Math.max(0,Number(historicalCount||0)/5))+Math.min(3,Math.max(0,confidence*3))+(strategy?1:0);
}
function selectBest({historical=[],twinA=null,twinB=null}){
 if(!twinA || !twinB) return {disposition:'BLOCK',reason:'BOTH_TWINS_REQUIRED'};
 const options=[{id:'TWIN_A',source:'CELL-003',value:twinA},{id:'TWIN_B',source:'CELL-004',value:twinB}]
   .map(({id,source,value})=>({id,source,value,strategyId:optionStrategy(value)}))
   .filter(x=>x.strategyId);
 if(options.length<2) return {disposition:'BLOCK',reason:'BOTH_TWINS_MUST_PROVIDE_ACTIONABLE_STRATEGY'};
 const ranked=options.map(({id,source,value,strategyId})=>({
   id,source,score:Number(scoreOption(value,historical.length).toFixed(3)),
   strategyId,targetSha:value?.targetSha??null,
   disposition:value?.challenge?.disposition??null
 })).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const best=ranked[0];
 return {
   disposition:best.score>=6?'SELECTED':'BLOCK',
   selected:best.score>=6?best.id:null,
   selectedStrategy:best.score>=6?best.strategyId:null,
   reason:best.score>=6?'BEST_TWIN_EVIDENCE':'INSUFFICIENT_TWIN_PROOF',
   ranked,
   tieCount:ranked.filter(x=>x.score===best.score).length,
   historicalSupport:historical.length
 };
}
if(role==='wake'){
 requireIdentity();
 const status=arg('status',process.env.FLIXO_WATCH_STATUS||'RED_INTERNAL');
 const branch=arg('branch','execution');
 if(branch!=='execution')throw new Error('ACTION_WAKE_BRANCH_BLOCKED');
 if(!['PUSH_READY','RED_INTERNAL','BLOCKED_EXTERNAL','FAIL_CLOSED'].includes(status))throw new Error('ACTION_WAKE_STATUS_NOT_ACTIONABLE');
 const result={schemaVersion:1,botId:'CELL-002',role:ROLE_MAP['CELL-002'],action:'WAKE_WHOLE_CELL',dispatcher:'FLIXO Execution Bot Watchdog',targetRunId:runId,targetSha,failureFingerprint:fingerprint,status,mutationAuthority:false,directDispatch:false,wholeCellReady:true,sharedReferences:SHARED_REFS,canonicalNextStep:status==='PUSH_READY'?'DAILY_FLIXO_GREEN_GATE':'EXISTING_CANONICAL_DISPATCHER'};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(role==='index'){
 requireIdentity();
 const records=historicalSolutions(12);
 const result={schemaVersion:1,botId:'CELL-001',role:ROLE_MAP['CELL-001'],targetSha,runId,failureFingerprint:fingerprint,logDigest,queryTerms:topTerms,historicalMatchCount:records.length,historicalMatches:records,sameReferences:true,sharedReferences:SHARED_REFS,mutationAuthority:false,recommendation:records.length?'HISTORICAL_CANDIDATES_FOUND':'NO_HISTORICAL_MATCH'};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',role,resultCount:records.length,output:out},null,2));process.exit(0);
}
if(role==='select'){
 requireIdentity();
 const histFile=arg('historical',process.env.FLIXO_HISTORICAL_SOLUTION_PATH);
 const aFile=arg('twin-a',process.env.FLIXO_TWIN_A_PATH);
 const bFile=arg('twin-b',process.env.FLIXO_TWIN_B_PATH);
 const historical=histFile&&fs.existsSync(histFile)?readJson(histFile).historicalMatches??[]:[];
 const twinA=aFile&&fs.existsSync(aFile)?readJson(aFile):null;
 const twinB=bFile&&fs.existsSync(bFile)?readJson(bFile):null;
 const selection=selectBest({historical,twinA,twinB});
 const result={schemaVersion:1,botId:'CELL-005',role:ROLE_MAP['CELL-005'],targetSha,runId,failureFingerprint:fingerprint,mutationAuthority:false,canonicalMutationOwner:'repairAgent',historicalSolutionCount:historical.length,twinAAvailable:Boolean(twinA),twinBAvailable:Boolean(twinB),selection};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(selection.disposition==='SELECTED'?0:2);
}
const logExists=Boolean(logPath&&fs.existsSync(logPath));
const packets=workerIds.map((id,i)=>({schemaVersion:1,workerId:id,workerIndex:i+1,role:ROLE_MAP[id],taskId:'ACTION-REPAIR:'+runId+':'+fingerprint,target:{runId,failedSha:targetSha,failureFingerprint:fingerprint,logDigest},sharedReferences:SHARED_REFS,sameIncidentContext:true,mutationAuthority:false,canonicalMutationOwner:'repairAgent',proofRule:'CURRENT_EXACT_SHA_CI_ONLY'}));
const report={schemaVersion:2,authority:'CELL_ACTION_REPAIR_WORKER_FANOUT',workerCount:5,workers:packets,sharedReferences:SHARED_REFS,sameReferencesForAll:true,anyActionFailureAdmitted:true,roleOrder:workerIds.map(id=>ROLE_MAP[id]),mutationModel:'FIVE_ROLES_ONE_CANONICAL_MUTATION_LANE',wakeModel:'CELL-002_TO_EXISTING_CANONICAL_DISPATCHER',selectionModel:'CELL-001+CELL-003+CELL-004_TO_CELL-005',logEvidencePresent:logExists,generatedAt:new Date().toISOString()};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',workerCount:5,roles:report.roleOrder,targetSha,runId,fingerprint,output:out},null,2));
