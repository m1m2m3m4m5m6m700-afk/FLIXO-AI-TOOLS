#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { query as queryHistoricalActionErrors } from './historical-action-error-index.mjs';
import { appendActionCenterEvent } from './action-repair-memory.mjs';

const ROOT=process.cwd();
const REGISTRY=path.join(ROOT,'docs/agents/ACTION-REPAIR-SQUAD-REGISTRY.json');
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
  'ACTION-INDEX':'ACTION_SOLUTION_INDEXER',
  'ACTION-WAKE':'ACTION_SYSTEM_WAKE_COORDINATOR',
  'ACTION-TWIN-1':'ACTION_REPAIR_TWIN_A',
  'ACTION-TWIN-2':'ACTION_REPAIR_TWIN_B',
  'ACTION-WISE':'ACTION_BEST_OPTION_SELECTOR'
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
const workerIds=Array.isArray(registry.workers)?registry.workers.map(worker=>worker.id):[];
if(!Array.isArray(workerIds)||workerIds.length!==5||new Set(workerIds).size!==5||workerIds.some(id=>!/^ACTION-(?:INDEX|WAKE|TWIN-1|TWIN-2|WISE)$/u.test(id)))throw new Error('FIVE_ACTION_REPAIR_SQUAD_REGISTRY_INVALID');
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
 const options=[{id:'TWIN_A',source:'ACTION-TWIN-1',value:twinA},{id:'TWIN_B',source:'ACTION-TWIN-2',value:twinB}]
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
 const result={schemaVersion:1,botId:'ACTION-WAKE',role:ROLE_MAP['ACTION-WAKE'],action:'WAKE_ACTION_REPAIR_SQUAD',dispatcher:'FLIXO Execution Bot Watchdog',targetRunId:runId,targetSha,failureFingerprint:fingerprint,status,mutationAuthority:false,directDispatch:false,actionRepairSquadReady:true,sharedReferences:SHARED_REFS,canonicalNextStep:status==='PUSH_READY'?'DAILY_FLIXO_GREEN_GATE':'EXISTING_CANONICAL_DISPATCHER'};
 appendActionCenterEvent({type:'WAKE',taskId:'ACTION-WAKE:'+runId+':'+fingerprint,fingerprint,runId,targetSha,actor:'ACTION-WAKE',payload:{status,dispatcher:result.dispatcher,canonicalNextStep:result.canonicalNextStep}});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(role==='index'){
 requireIdentity();
 const records=historicalSolutions(12);
 const result={schemaVersion:1,botId:'ACTION-INDEX',role:ROLE_MAP['ACTION-INDEX'],targetSha,runId,failureFingerprint:fingerprint,logDigest,queryTerms:topTerms,historicalMatchCount:records.length,historicalMatches:records,sameReferences:true,sharedReferences:SHARED_REFS,mutationAuthority:false,recommendation:records.length?'HISTORICAL_CANDIDATES_FOUND':'NO_HISTORICAL_MATCH'};
 appendActionCenterEvent({type:'HISTORICAL_MATCHES',taskId:'ACTION-INDEX:'+runId+':'+fingerprint,fingerprint,runId,targetSha,actor:'ACTION-INDEX',payload:{logDigest,queryTerms:topTerms,historicalMatchCount:records.length,matchIds:records.map(x=>x.id).filter(Boolean)}});
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
 const result={schemaVersion:1,botId:'ACTION-WISE',role:ROLE_MAP['ACTION-WISE'],targetSha,runId,failureFingerprint:fingerprint,mutationAuthority:false,canonicalMutationOwner:'repairAgent',historicalSolutionCount:historical.length,twinAAvailable:Boolean(twinA),twinBAvailable:Boolean(twinB),selection};
 appendActionCenterEvent({type:'WISE_SELECTION',taskId:'ACTION-WISE:'+runId+':'+fingerprint,fingerprint,runId,targetSha,actor:'ACTION-WISE',payload:{historicalSolutionCount:historical.length,twinAAvailable:Boolean(twinA),twinBAvailable:Boolean(twinB),selection}});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(selection.disposition==='SELECTED'?0:2);
}
const logExists=Boolean(logPath&&fs.existsSync(logPath));
const packets=workerIds.map((id,i)=>({schemaVersion:1,workerId:id,workerIndex:i+1,role:ROLE_MAP[id],taskId:'ACTION-REPAIR:'+runId+':'+fingerprint,target:{runId,failedSha:targetSha,failureFingerprint:fingerprint,logDigest},sharedReferences:SHARED_REFS,sameIncidentContext:true,mutationAuthority:false,canonicalMutationOwner:'repairAgent',proofRule:'CURRENT_EXACT_SHA_CI_ONLY'}));
const report={schemaVersion:2,authority:'ACTION_REPAIR_SQUAD_FANOUT',workerCount:5,workers:packets,sharedReferences:SHARED_REFS,sameReferencesForAll:true,anyActionFailureAdmitted:true,roleOrder:workerIds.map(id=>ROLE_MAP[id]),mutationModel:'FIVE_ROLES_ONE_CANONICAL_MUTATION_LANE',wakeModel:'ACTION-WAKE_TO_EXISTING_CANONICAL_DISPATCHER',selectionModel:'ACTION-INDEX+ACTION-TWIN-1+ACTION-TWIN-2_TO_ACTION-WISE',logEvidencePresent:logExists,generatedAt:new Date().toISOString()};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',workerCount:5,roles:report.roleOrder,targetSha,runId,fingerprint,output:out},null,2));
