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
  'ACTION-INDEX':'ACTION_SOLUTION_INDEXER_SUPPORT',
  'ACTION-REPAIR':'ACTION_REPAIR_EXECUTOR',
  'ACTION-WAKE':'ACTION_SYSTEM_WAKE_COORDINATOR',
  'ACTION-TWIN-1':'ACTION_REPAIR_TWIN_A',
  'ACTION-TWIN-2':'ACTION_REPAIR_TWIN_B',
  'ACTION-WISE':'ACTION_BEST_OPTION_SELECTOR',
  'ACTION-RCA-3':'ACTION_RCA_EVIDENCE_REVIEW',
  'ACTION-IMPACT-4':'ACTION_BLAST_RADIUS_REVIEW',
  'ACTION-SECURITY-5':'ACTION_SECURITY_BOUNDARY_REVIEW',
  'ACTION-REGRESSION-6':'ACTION_REGRESSION_PLANNER',
  'ACTION-SHA-7':'ACTION_CERTIFIER_ADVERSARY',
  'ACTION-CONVERGENCE-8':'ACTION_FINAL_CERTIFIER'
});
const FLIXO10_IDS=Object.freeze(['FLIXO1','FLIXO2','FLIXO3','FLIXO4','FLIXO5','FLIXO6','FLIXO7','FLIXO8','FLIXO9','FLIXO10']);
const nextFlixo=(id)=>{const index=FLIXO10_IDS.indexOf(String(id).toUpperCase());if(index<0)throw new Error('FLIXO10_ID_INVALID='+id);return FLIXO10_IDS[(index+1)%FLIXO10_IDS.length]};
const FLIXO10_RING=Object.freeze(FLIXO10_IDS.map((proposal)=>Object.freeze({proposal,adversary:nextFlixo(proposal)})));
const sha=v=>/^[a-f0-9]{40}$/iu.test(String(v??''));
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):String(fallback)};
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const targetSha=arg('target-sha',process.env.FLIXO_EXPECTED_TARGET_SHA);
const runId=arg('run-id',process.env.TARGET_RUN_ID);
const fingerprint=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT);
const logPath=arg('log',process.env.FLIXO_FAILURE_LOG||'');
const role=arg('role','fanout');
const out=arg('output',process.env.FLIXO_TEN_ACTION_REPAIR_OUTPUT||'/tmp/flixo-ten-action-repair-workers.json');
const normalize=s=>String(s??'').replace(new RegExp(String.fromCharCode(27)+'\\[[0-?]*[ -/]*[@-~]','gu'),'').replace(/\\s+/gu,' ').trim();
const digest=s=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const requireIdentity=()=>{if(!sha(targetSha))throw new Error('TEN_ACTION_REPAIR_TARGET_SHA_INVALID');if(!runId)throw new Error('TEN_ACTION_REPAIR_RUN_ID_REQUIRED');if(!fingerprint)throw new Error('TEN_ACTION_REPAIR_FINGERPRINT_REQUIRED')};
const requireWakeIdentity=()=>{if(!sha(targetSha))throw new Error('TEN_ACTION_REPAIR_TARGET_SHA_INVALID');if(!runId)throw new Error('TEN_ACTION_REPAIR_RUN_ID_REQUIRED')};
const registry=readJson(REGISTRY);
const registryWorkerIds=Array.isArray(registry.workers)?registry.workers.map(worker=>worker.id):[];
const workerIds=registry.workers
  .filter(worker=>worker?.kind==='ACTION_REPAIR_BOT' && worker?.status==='READY')
  .map(worker=>worker.id);
const expectedWorkerIds=['ACTION-TWIN-1','ACTION-TWIN-2','ACTION-INDEX','ACTION-WISE','ACTION-RCA-3','ACTION-IMPACT-4','ACTION-SECURITY-5','ACTION-REGRESSION-6','ACTION-SHA-7','ACTION-CONVERGENCE-8'];
if(!Array.isArray(registryWorkerIds)||!registryWorkerIds.includes('ACTION-HISTORIAN-3')||
   workerIds.length!==10||new Set(workerIds).size!==10||
   expectedWorkerIds.some(id=>!workerIds.includes(id))||
   workerIds.some(id=>!ROLE_MAP[id])) {
  throw new Error('TEN_ACTION_REPAIR_SQUAD_REGISTRY_INVALID');
}
const executor=registry.repairExecutor;
if(!executor || executor.id!=='ACTION-REPAIR' || executor.protocolActor!=='actionRepairBot' || executor.mutationAuthority!==true || executor.executionAuthority!=='SOURCE_MUTATION_VIA_REPAIR_PROTOCOL' || executor.branch!=='execution' || Number(executor.maxAttemptsPerFingerprint)!==1000000 || executor.canMutateMain!==false || executor.canMutateTests!==false) throw new Error('ACTION_REPAIR_EXECUTOR_REGISTRY_INVALID');
const missing=SHARED_REFS.filter(ref=>!fs.existsSync(path.join(ROOT,ref)));
if(missing.length)throw new Error('TEN_ACTION_REPAIR_SHARED_REFERENCE_MISSING='+missing.join(','));
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
if(role==='pair-gate'){
 requireIdentity();
 const evidencePath=arg('pair-evidence',process.env.FLIXO10_PAIR_EVIDENCE_PATH);
 if(!evidencePath || !fs.existsSync(evidencePath)) throw new Error('FLIXO10_PAIR_EVIDENCE_REQUIRED');
 const evidence=readJson(evidencePath);
 const pairs=Array.isArray(evidence.pairs)?evidence.pairs:[];
 const byKey=new Map(pairs.map(pair=>[(pair.proposal||'')+'|'+(pair.adversary||''),pair]));
 const failures=[];
 for(const pair of FLIXO10_RING){
   const key=pair.proposal+'|'+pair.adversary;
   const item=byKey.get(key);
   if(!item) { failures.push({pair,reason:'PAIR_EVIDENCE_MISSING'}); continue; }
   if(item.targetSha!==targetSha) failures.push({pair,reason:'PAIR_SHA_MISMATCH'});
   if(item.status!=='PASS') failures.push({pair,reason:'PAIR_NOT_PASS'});
   if(item.counterexampleFound===true) failures.push({pair,reason:'COUNTEREXAMPLE_FOUND'});
   if(item.adversaryIndependent!==true) failures.push({pair,reason:'ADVERSARY_NOT_INDEPENDENT'});
   if(item.readComplete!==true || item.diagnosisComplete!==true || item.proposalWritten!==true) failures.push({pair,reason:'PAIR_WORKFLOW_INCOMPLETE'});
 }
 const result={schemaVersion:1,protocol:'FLIXO10-PAIR-GATE-v1',taskId:'ACTION-REPAIR:'+runId+':'+fingerprint,targetSha,failureFingerprint:fingerprint,pairCount:FLIXO10_RING.length,pairs:FLIXO10_RING,ringPolicy:'FLIXO1→FLIXO2→FLIXO3→FLIXO4→FLIXO5→FLIXO6→FLIXO7→FLIXO8→FLIXO9→FLIXO10→FLIXO1',failures,status:failures.length?'BLOCKED':'PASS',publicationAdmit:failures.length===0,mutationAuthority:false,pushAuthority:failures.length===0?'FIRST_CONNECTED_FLIXO10_GUARDED_ONLY':'BLOCKED',next:failures.length?'RETURN_TO_PAIR_REPAIR':'ALLOW_PUSH_OWNER_TO_MERGE_PROPOSALS_AND_REQUEST_GUARDED_PUBLICATION'};
 fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2)); process.exit(failures.length?2:0);
}
if(role==='push-admit'){
 requireIdentity();
 const pairGatePath=arg('pair-gate',process.env.FLIXO10_PAIR_GATE_PATH);
 if(!pairGatePath || !fs.existsSync(pairGatePath)) throw new Error('FLIXO10_PAIR_GATE_REQUIRED');
 const pairGate=readJson(pairGatePath);
 if(pairGate.targetSha!==targetSha || pairGate.status!=='PASS' || pairGate.publicationAdmit!==true) throw new Error('FLIXO10_PUSH_ADMISSION_PAIR_GATE_FAILED');
 const owner=arg('owner').toUpperCase();
 if(!FLIXO10_IDS.includes(owner)) throw new Error('FLIXO10_PUSH_OWNER_REQUIRED');
 const result={schemaVersion:1,protocol:'FLIXO10-PUSH-ADMISSION-v1',targetSha,runId,failureFingerprint:fingerprint,owner,pairGate:'PASS',allPairsPassed:true,publicationAdmit:true,mergeParallelProposals:true,pushRoute:'ASSISTANT_CONTROLLER_GUARDED_PUBLICATION',directGitPush:false,mainMutation:false};
 fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2)); process.exit(0);
}
if(role==='wake'){
 requireWakeIdentity();
 const status=arg('status',process.env.FLIXO_WATCH_STATUS||'RED_INTERNAL');
 const wakeFingerprint=fingerprint||('WAKE-'+targetSha.slice(0,12)+'-'+runId);
 const branch=arg('branch','execution');
 if(branch!=='execution')throw new Error('ACTION_WAKE_BRANCH_BLOCKED');
 if(!['PUSH_READY','RED_INTERNAL','BLOCKED_EXTERNAL','FAIL_CLOSED','RESIDENT_HEARTBEAT','ACTIVE_OPERATION','ACTIONABLE_RED_REENTRY'].includes(status))throw new Error('ACTION_WAKE_STATUS_INVALID');
 const teamIds=FLIXO10_IDS;
 const result={schemaVersion:2,botId:'FLIXO_HEARTBEAT_CONTROLLER',role:'CANONICAL_WAKE_CONTROLLER',action:'WAKE_ALL_ACTION_REPAIR_TEAM',wakeScope:'ALL_ACTION_REPAIR_TEAM',wakePolicy:'ANY_ACTIVE_ACTION_REPAIR_BOT_WAKES_ALL',dispatcher:'FLIXO_AGENT_REPAIR_HEARTBEAT',targetRunId:runId,targetSha,failureFingerprint:wakeFingerprint,status,mutationAuthority:false,directDispatch:false,actionRepairSquadReady:true,recipientCount:teamIds.length,recipients:teamIds,sourceMutationOwner:'ACTION-REPAIR',pushAuthority:'CHAIR_1_ONLY',sharedReferences:SHARED_REFS,canonicalNextStep:status==='PUSH_READY' || status==='RED_INTERNAL' || status==='ACTIONABLE_RED_REENTRY'?'DAILY_FLIXO_GREEN_GATE':status==='RESIDENT_HEARTBEAT'?'FULL_REPOSITORY_READ_ONLY_SCAN':'CONTINUE_ACTIVE_OPERATION'};
 appendActionCenterEvent({type:'WAKE',taskId:'ACTION-WAKE:'+runId+':'+wakeFingerprint,fingerprint:wakeFingerprint,runId,targetSha,actor:'ACTION-WAKE',payload:{status,dispatcher:result.dispatcher,wakeScope:result.wakeScope,recipientCount:result.recipientCount,recipients:result.recipients,canonicalNextStep:result.canonicalNextStep}});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(role==='repair-search'){
 requireIdentity();
 const currentLog=rawLog;
 const currentTerms=topTerms;
 let liveLogDigest=null;
 let liveFailureLines=[];
 if(currentLog){
   liveLogDigest=digest(currentLog);
   liveFailureLines=currentLog.split(/\r?\n/u).filter(Boolean).slice(-250);
 }
 const records=historicalSolutions(20);
 const result={
   schemaVersion:1,botId:'ACTION-REPAIR',role:ROLE_MAP['ACTION-REPAIR'],
   targetSha,runId,failureFingerprint:fingerprint,
   indexOwner:true,directActionSearch:true,searchBeforeMutation:true,
   indexPath:"docs/agents/historical-action-errors/index.json",
   recordsPath:"docs/agents/historical-action-errors/records",
   currentActionLog:{present:Boolean(currentLog),digest:liveLogDigest,recentFailureLines:liveFailureLines},
   queryTerms:currentTerms,
   historicalMatchCount:records.length,
   historicalMatches:records,
   searchEngine:"scripts/ci/historical-action-error-index.mjs",
   proofAuthority:"CURRENT_EXACT_SHA_CI_ONLY",
   mutationAuthority:true,executionAuthority:"SOURCE_MUTATION_VIA_REPAIR_PROTOCOL"
 };
 appendActionCenterEvent({type:'HISTORICAL_MATCHES',taskId:'ACTION-REPAIR:'+runId+':'+fingerprint,fingerprint,runId,targetSha,actor:'ACTION-REPAIR',payload:{
   searchMode:'SELF_INDEX_SEARCH',historicalMatchCount:records.length,queryTerms:currentTerms,liveLogDigest,
   matchIds:records.map(x=>x.id).filter(Boolean)
 }});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',role:result.role,resultCount:records.length,indexOwner:true,output:out},null,2));process.exit(0);
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
const packets=FLIXO10_IDS.map((id,i)=>{const opponent=nextFlixo(id);return {schemaVersion:3,workerId:id,workerIndex:i+1,role:'FLIXO_TEAM',lifecycle:'AWAKE_RESIDENT',wakeSource:'FLIXO_AGENT_REPAIR_HEARTBEAT',resident:true,heartbeatAt:new Date().toISOString(),ringPosition:i+1,taskReceiptRole:'PROPOSER_AND_RING_MEMBER',adversaryBot:opponent,adversaryRole:'DYNAMIC_ON_TASK_RECEIPT',legacyRole:Object.entries(ROLE_MAP).find(([,value])=>value===['ACTION_REPAIR_TWIN_A','ACTION_REPAIR_TWIN_B','ACTION_SOLUTION_INDEXER_SUPPORT','ACTION_BEST_OPTION_SELECTOR','ACTION_RCA_EVIDENCE_REVIEW','ACTION_BLAST_RADIUS_REVIEW','ACTION_SECURITY_BOUNDARY_REVIEW','ACTION_REGRESSION_PLANNER','ACTION_CERTIFIER_ADVERSARY','ACTION_FINAL_CERTIFIER'][i])?.[0]??null,systemScope:'FULL_REPOSITORY_AND_AUTOMATION_SYSTEM',workflow:'READ→DIAGNOSE→WRITE_PROPOSAL→RING_CHALLENGE→HANDOFF',cloneSource:'FLIXO-BOT-SYSTEM-WIDE-INTELLIGENCE',intelligenceVersion:'FLIXO-BOT-BRAIN-v1',cognitiveParity:'EXACT_SHARED_BY_REFERENCE',taskId:'ACTION-REPAIR:'+runId+':'+fingerprint,target:{runId,failedSha:targetSha,failureFingerprint:fingerprint,logDigest},sharedReferences:SHARED_REFS,sameIncidentContext:true,mutationAuthority:false,canonicalMutationOwner:'DYNAMIC_FLIXO10_PUSH_SEAT',pushSeatEligible:true,pushAuthority:'FIRST_CONNECTED_FLIXO10_ONLY',proofRule:'CURRENT_EXACT_SHA_CI_ONLY'};});
const report={schemaVersion:3,authority:'ACTION_REPAIR_SQUAD_FANOUT',lifecycle:'AWAKE_RESIDENT',wakeSource:'FLIXO_AGENT_REPAIR_HEARTBEAT',targetSha,runId,failureFingerprint:fingerprint,residentWorkerCount:10,workerCount:10,workers:packets,sharedReferences:SHARED_REFS,sameReferencesForAll:true,anyActionFailureAdmitted:true,roleOrder:FLIXO10_IDS,mutationModel:'TEN_CLONED_FLIXO_BOT_ROLES_ONE_CANONICAL_MUTATION_LANE',wakeModel:'EXISTING_CANONICAL_DISPATCHER_ONLY',selectionModel:'TEN_WORKER_RING_EVIDENCE_TO_ACTION-REPAIR',ringModel:'NEXT_BOT_IS_DYNAMIC_ADVERSARY_ON_TASK_RECEIPT',cloneModel:'ONE_SHARED_COGNITIVE_KERNEL_WITH_ROLE_OVERLAYS',pushAuthority:'CHAIR_1_ONLY',sourceMutationOwner:'ACTION-REPAIR',logEvidencePresent:logExists,generatedAt:new Date().toISOString()};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',workerCount:10,roles:report.roleOrder,targetSha,runId,fingerprint,output:out},null,2));
